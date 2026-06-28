import { formatInTimeZone } from 'date-fns-tz';
import { eq } from 'drizzle-orm';

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

export function formatLastScanTime(scannedAt: string | null) {
  if (!scannedAt) return '';
  return formatInTimeZone(
    new Date(scannedAt),
    'America/Argentina/Buenos_Aires',
    'HH:mm',
  );
}
