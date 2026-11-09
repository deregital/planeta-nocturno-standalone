import { and, eq, sql } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import { emittedTicket, emittedTicketScan } from '@/drizzle/schema';

type DbExecutor = Pick<Db, 'insert' | 'update'>;

async function applyTicketScan(
  tx: DbExecutor,
  ticketId: string,
  scannedByUserId: string,
  now: string,
) {
  await tx.insert(emittedTicketScan).values({
    emittedTicketId: ticketId,
    scannedAt: now,
    scannedByUserId,
  });

  await tx
    .update(emittedTicket)
    .set({
      scanned: true,
      scannedAt: now,
      scannedByUserId,
    })
    .where(eq(emittedTicket.id, ticketId));
}

export async function registerTicketScan(
  db: Db,
  ticketId: string,
  scannedByUserId: string,
) {
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await applyTicketScan(tx, ticketId, scannedByUserId, now);
  });

  return now;
}

export async function registerTicketScanInTx(
  tx: DbExecutor,
  ticketId: string,
  scannedByUserId: string,
) {
  const now = new Date().toISOString();
  await applyTicketScan(tx, ticketId, scannedByUserId, now);
  return now;
}

export function canRegisterScan(ticket: {
  scanned: boolean;
  ticketType: {
    allowMultipleScans: boolean;
  };
}): { allowed: true } | { allowed: false; reason: 'already-scanned' } {
  if (ticket.scanned && !ticket.ticketType.allowMultipleScans) {
    return { allowed: false, reason: 'already-scanned' };
  }

  return { allowed: true };
}

/**
 * Marca el ingreso de forma atómica: el UPDATE sólo gana si el ticket todavía
 * no fue escaneado (o si el tipo permite multiescaneo). Dos lectores que
 * escanean el mismo QR a la vez se serializan en el lock de fila, así que sólo
 * uno registra el ingreso. Devuelve `registered: false` cuando ya estaba.
 */
export async function tryRegisterTicketScan(
  db: Db,
  ticketId: string,
  scannedByUserId: string,
  allowMultipleScans: boolean,
): Promise<{ registered: true; scannedAt: string } | { registered: false }> {
  return db.transaction((tx) =>
    tryRegisterTicketScanInTx(
      tx,
      ticketId,
      scannedByUserId,
      allowMultipleScans,
    ),
  );
}

/**
 * Igual que `tryRegisterTicketScan`, dentro de una transacción abierta.
 *
 * `at`: hora del ingreso cuando no es ahora (un escaneo decidido en el celular
 * que se sube después). Con multiescaneo, la última hora de la entrada no
 * retrocede: un escaneo viejo que llega tarde queda en el historial, pero la
 * entrada conserva el escaneo más reciente y quién lo hizo.
 */
export async function tryRegisterTicketScanInTx(
  tx: DbExecutor,
  ticketId: string,
  scannedByUserId: string,
  allowMultipleScans: boolean,
  { at }: { at?: string } = {},
): Promise<{ registered: true; scannedAt: string } | { registered: false }> {
  const now = at ?? new Date().toISOString();

  const updated = await tx
    .update(emittedTicket)
    .set(
      at
        ? {
            scanned: true,
            scannedAt: sql`GREATEST(COALESCE(${emittedTicket.scannedAt}, ${now}::timestamptz), ${now}::timestamptz)`,
            scannedByUserId: sql`CASE WHEN ${emittedTicket.scannedAt} IS NULL OR ${emittedTicket.scannedAt} <= ${now}::timestamptz THEN ${scannedByUserId}::uuid ELSE ${emittedTicket.scannedByUserId} END`,
          }
        : { scanned: true, scannedAt: now, scannedByUserId },
    )
    .where(
      allowMultipleScans
        ? eq(emittedTicket.id, ticketId)
        : and(eq(emittedTicket.id, ticketId), eq(emittedTicket.scanned, false)),
    )
    .returning({ id: emittedTicket.id });

  if (updated.length === 0) {
    return { registered: false };
  }

  await tx.insert(emittedTicketScan).values({
    emittedTicketId: ticketId,
    scannedAt: now,
    scannedByUserId,
  });

  return { registered: true, scannedAt: now };
}

/** Hora (Argentina) de un escaneo; ver `formatScanTime` en `@/lib/scan/scan-texts`. */
export { formatScanTime as formatLastScanTime } from '@/lib/scan/scan-texts';
