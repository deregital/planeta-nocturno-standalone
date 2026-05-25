import { and, eq, ne, sql } from 'drizzle-orm';

import { db } from '@/drizzle';

import {
  emittedTicket,
  ticketGroup,
  ticketType,
  ticketTypePerGroup,
} from '@/drizzle/schema';

export async function getCalendarStatsByEventId(eventId: string) {
  const [salesStats] = await db
    .select({
      ticketsSold: sql<number>`coalesce(sum(${ticketTypePerGroup.amount}), 0)`,
      totalRaised: sql<number>`coalesce(sum(${ticketTypePerGroup.amount} * coalesce(${ticketType.price}, 0)), 0)`,
    })
    .from(ticketTypePerGroup)
    .innerJoin(
      ticketGroup,
      eq(ticketGroup.id, ticketTypePerGroup.ticketGroupId),
    )
    .innerJoin(ticketType, eq(ticketType.id, ticketTypePerGroup.ticketTypeId))
    .where(
      and(eq(ticketGroup.eventId, eventId), ne(ticketGroup.status, 'BOOKED')),
    );

  const [attendanceStats] = await db
    .select({
      ticketsIssued: sql<number>`count(${emittedTicket.id})`,
      ticketsScanned: sql<number>`coalesce(sum(case when ${emittedTicket.scanned} then 1 else 0 end), 0)`,
    })
    .from(emittedTicket)
    .innerJoin(ticketGroup, eq(ticketGroup.id, emittedTicket.ticketGroupId))
    .where(
      and(eq(ticketGroup.eventId, eventId), ne(ticketGroup.status, 'BOOKED')),
    );

  const ticketsIssued = Number(attendanceStats?.ticketsIssued ?? 0);
  const ticketsScanned = Number(attendanceStats?.ticketsScanned ?? 0);

  return {
    ticketsSold: Number(salesStats?.ticketsSold ?? 0),
    ticketsIssued,
    ticketsScanned,
    attendanceRate:
      ticketsIssued > 0 ? (ticketsScanned / ticketsIssued) * 100 : 0,
    totalRaised: Number(salesStats?.totalRaised ?? 0),
  };
}
