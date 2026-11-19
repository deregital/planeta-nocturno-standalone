import { createHash } from 'crypto';

import { eq, lt, sql } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { rateLimitBucket } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';

export type RateLimitRule = {
  /** Identificador del contador, p. ej. `invite:ip:<hash>`. */
  key: string;
  /** Intentos permitidos dentro de la ventana. */
  limit: number;
  windowSeconds: number;
};

/** Filas más viejas que esto se borran de forma oportunista. */
const CLEANUP_AFTER_SECONDS = 24 * 60 * 60;
const CLEANUP_PROBABILITY = 0.01;

/**
 * IP del cliente según el proxy (Vercel / reverse proxy pisan estos headers).
 * Se devuelve hasheada: alcanza para agrupar intentos sin guardar la IP.
 */
export function getClientIpKey(headers: Headers): string {
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

async function consume(db: Db, rule: RateLimitRule): Promise<number> {
  const expired = sql`${rateLimitBucket.windowStart} <= now() - make_interval(secs => ${rule.windowSeconds})`;
  const [row] = await db
    .insert(rateLimitBucket)
    .values({ key: rule.key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: rateLimitBucket.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimitBucket.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${rateLimitBucket.windowStart} END`,
      },
    })
    .returning({ count: rateLimitBucket.count });
  return row?.count ?? 1;
}

/**
 * Suma un intento a cada regla de forma atómica. Devuelve `false` si alguna
 * superó su límite. Como el intento se cuenta antes de procesar el pedido, los
 * pedidos en paralelo no pueden saltearse el límite.
 */
export async function consumeRateLimit(
  db: Db,
  rules: RateLimitRule[],
): Promise<boolean> {
  if (Math.random() < CLEANUP_PROBABILITY) {
    void db
      .delete(rateLimitBucket)
      .where(
        lt(
          rateLimitBucket.windowStart,
          sql`now() - make_interval(secs => ${CLEANUP_AFTER_SECONDS})`,
        ),
      )
      .catch((error) =>
        logger.warn('No se pudieron limpiar los rate limits', { error }),
      );
  }

  const counts = await Promise.all(rules.map((rule) => consume(db, rule)));
  return counts.every((count, i) => count <= rules[i].limit);
}

/**
 * Descuenta el intento sumado por `consumeRateLimit`. Se usa cuando sólo
 * interesa limitar los intentos fallidos.
 */
export async function refundRateLimit(db: Db, rules: RateLimitRule[]) {
  await Promise.all(
    rules.map((rule) =>
      db
        .update(rateLimitBucket)
        .set({ count: sql`GREATEST(${rateLimitBucket.count} - 1, 0)` })
        .where(eq(rateLimitBucket.key, rule.key)),
    ),
  );
}
