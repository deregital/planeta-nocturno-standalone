import type { Db } from '@/drizzle';

import {
  getNightMetrics,
  type NightMetrics,
} from '@/server/services/nightMetrics';

/**
 * Lo que muestran el calendario de /control y el de Pluto. Sale de las
 * métricas de la noche, así que cuenta igual que el resto de las pantallas:
 * sin las entradas de los organizadores ni las reservas sin pagar.
 */
export function calendarStatsFromMetrics(metrics: NightMetrics | undefined) {
  const ticketsIssued = metrics?.tickets.valid ?? 0;
  const ticketsScanned = metrics
    ? metrics.tickets.valid - metrics.tickets.pending
    : 0;

  return {
    ticketsSold: metrics?.tickets.sold ?? 0,
    ticketsIssued,
    ticketsScanned,
    attendanceRate:
      ticketsIssued > 0 ? (ticketsScanned / ticketsIssued) * 100 : 0,
    totalRaised: metrics?.raised ?? 0,
  };
}

export async function getCalendarStatsByEventId(db: Db, eventId: string) {
  const [metrics] = await getNightMetrics(db, [eventId]);
  return calendarStatsFromMetrics(metrics);
}

/** Las de varios eventos de una misma base, en una sola tanda de consultas. */
export async function getCalendarStatsByEventIds(db: Db, eventIds: string[]) {
  const metrics = await getNightMetrics(db, eventIds);
  const byId = new Map(metrics.map((item) => [item.event.id, item]));
  return new Map(
    eventIds.map((id) => [id, calendarStatsFromMetrics(byId.get(id))]),
  );
}
