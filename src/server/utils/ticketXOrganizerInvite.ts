import { eq, max } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketXorganizer } from '@/drizzle/schema';

/** Pass `db` or a drizzle transaction handle. */
export async function allocateTicketXOrganizerShortIds(
  executor: Pick<Db, 'select'>,
  eventId: string,
  count: number,
): Promise<number[]> {
  if (count <= 0) {
    return [];
  }
  const [row] = await executor
    .select({ m: max(ticketXorganizer.shortId) })
    .from(ticketXorganizer)
    .where(eq(ticketXorganizer.eventId, eventId));
  const start = Number(row?.m ?? 0);
  return Array.from({ length: count }, (_, i) => start + i + 1);
}
