import { sql, type SQL } from 'drizzle-orm';

import { logger } from '@/server/observability/logger';

/**
 * Freno a la fuerza bruta en el login: después de 5 intentos fallidos seguidos
 * para un usuario, cada intento nuevo espera cada vez más (1, 2, 4, 8 y hasta
 * 15 minutos). Se guarda en la base porque en Vercel cada request puede caer
 * en otra instancia. Los fallos de hace más de una hora no cuentan.
 */
const FREE_ATTEMPTS = 5;
const MAX_LOCK_MS = 15 * 60 * 1000;

type Executor = {
  execute: (query: SQL) => PromiseLike<{ rows: Record<string, unknown>[] }>;
};

type AttemptsTable = {
  name: string;
  failedCount: string;
  lockedUntil: string;
  lastFailedAt: string;
};

export const TENANT_LOGIN_ATTEMPTS: AttemptsTable = {
  name: 'loginAttempt',
  failedCount: 'failedCount',
  lockedUntil: 'lockedUntil',
  lastFailedAt: 'lastFailedAt',
};

export const CONTROL_LOGIN_ATTEMPTS: AttemptsTable = {
  name: 'login_attempts',
  failedCount: 'failed_count',
  lockedUntil: 'locked_until',
  lastFailedAt: 'last_failed_at',
};

function key(username: string) {
  return username.trim().toLowerCase();
}

export function lockDurationMs(failedCount: number) {
  if (failedCount < FREE_ATTEMPTS) return 0;
  return Math.min(60_000 * 2 ** (failedCount - FREE_ATTEMPTS), MAX_LOCK_MS);
}

/**
 * Si la tabla todavía no existe (código desplegado antes de migrar) o la base
 * falla, el login sigue andando sin el freno: nunca dejar a todos afuera.
 */
async function failOpen<T>(
  operation: string,
  fallback: T,
  run: () => Promise<T>,
) {
  try {
    return await run();
  } catch (error) {
    logger.warn('Login throttle unavailable', { operation, error });
    return fallback;
  }
}

/** Minutos que faltan para poder volver a intentar, o 0 si puede intentar ya. */
export function loginLockedMinutes(
  db: Executor,
  table: AttemptsTable,
  username: string,
) {
  return failOpen('check', 0, () => lockedMinutes(db, table, username));
}

async function lockedMinutes(
  db: Executor,
  table: AttemptsTable,
  username: string,
) {
  const { rows } = await db.execute(
    sql`select ${sql.identifier(table.lockedUntil)} as "lockedUntil"
        from ${sql.identifier(table.name)}
        where "username" = ${key(username)}`,
  );
  const lockedUntil = rows[0]?.lockedUntil;
  if (!lockedUntil) return 0;
  const remaining = new Date(String(lockedUntil)).getTime() - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 60_000) : 0;
}

export function registerFailedLogin(
  db: Executor,
  table: AttemptsTable,
  username: string,
) {
  return failOpen('fail', undefined, () => recordFailure(db, table, username));
}

async function recordFailure(
  db: Executor,
  table: AttemptsTable,
  username: string,
) {
  const t = sql.identifier(table.name);
  const failedCount = sql.identifier(table.failedCount);
  const lastFailedAt = sql.identifier(table.lastFailedAt);
  const { rows } = await db.execute(
    sql`insert into ${t} ("username", ${failedCount}, ${lastFailedAt})
        values (${key(username)}, 1, now())
        on conflict ("username") do update set
          ${failedCount} = case
            when ${t}.${lastFailedAt} < now() - interval '1 hour' then 1
            else ${t}.${failedCount} + 1
          end,
          ${lastFailedAt} = now()
        returning ${failedCount} as "failedCount"`,
  );
  const lockMs = lockDurationMs(Number(rows[0]?.failedCount ?? 0));
  if (lockMs > 0) {
    await db.execute(
      sql`update ${t}
          set ${sql.identifier(table.lockedUntil)} = now() + ${`${lockMs} milliseconds`}::interval
          where "username" = ${key(username)}`,
    );
  }
}

export function registerSuccessfulLogin(
  db: Executor,
  table: AttemptsTable,
  username: string,
) {
  return failOpen('success', undefined, async () => {
    await db.execute(
      sql`delete from ${sql.identifier(table.name)} where "username" = ${key(username)}`,
    );
  });
}
