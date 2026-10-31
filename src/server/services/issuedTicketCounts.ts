import { count, inArray } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { emittedTicket } from '@/drizzle/schema';

/** Total de entradas emitidas por evento, sin separar por tipo. */
export async function countIssuedTicketsByEventId(db: Db, eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds)];
  if (uniqueIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      eventId: emittedTicket.eventId,
      total: count(emittedTicket.id),
    })
    .from(emittedTicket)
    .where(inArray(emittedTicket.eventId, uniqueIds))
    .groupBy(emittedTicket.eventId);

  return new Map(rows.map((row) => [row.eventId, Number(row.total)]));
}
