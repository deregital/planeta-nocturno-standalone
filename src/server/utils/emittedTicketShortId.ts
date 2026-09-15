import { eq, max, sql } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { emittedTicket } from '@/drizzle/schema';

/** Namespace for pg_advisory_xact_lock(key1, key2) — avoids clashes with other advisory locks. */
const EMITTED_TICKET_SHORT_ID_LOCK_NS = 742_192;

/**
 * Reserves consecutive shortIds for an event. Must run on a transaction handle (`tx`)
 * so the advisory lock is held until commit and matches the subsequent inserts.
 */
export async function allocateEmittedTicketShortIds(
  executor: Pick<Db, 'select' | 'execute'>,
  eventId: string,
  count: number,
): Promise<number[]> {
  if (count <= 0) {
    return [];
  }

  await executor.execute(
    sql`SELECT pg_advisory_xact_lock(${EMITTED_TICKET_SHORT_ID_LOCK_NS}, hashtext(${eventId}))`,
  );

  const [row] = await executor
    .select({ m: max(emittedTicket.shortId) })
    .from(emittedTicket)
    .where(eq(emittedTicket.eventId, eventId));
  const start = Number(row?.m ?? 0);
  return Array.from({ length: count }, (_, i) => start + i + 1);
}
