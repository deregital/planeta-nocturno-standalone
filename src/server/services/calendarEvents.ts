import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { event, location } from '@/drizzle/schema';

export type CalendarEvent = {
  id: string;
  slug: string;
  name: string;
  startingDate: string;
  endingDate: string;
  coverImageUrl: string;
  locationName: string | null;
  locationAddress: string | null;
};

/** Eventos activos de un tenant que se superponen con el rango [from, to]. */
export async function getCalendarEvents(
  db: Db,
  range: { from: string; to: string },
): Promise<CalendarEvent[]> {
  const rows = await db
    .select({
      id: event.id,
      slug: event.slug,
      name: event.name,
      startingDate: event.startingDate,
      endingDate: event.endingDate,
      coverImageUrl: event.coverImageUrl,
      locationName: location.name,
      locationAddress: location.address,
    })
    .from(event)
    .leftJoin(location, eq(location.id, event.locationId))
    .where(
      and(
        eq(event.isActive, true),
        eq(event.isDeleted, false),
        isNotNull(event.startingDate),
        isNotNull(event.endingDate),
        lte(event.startingDate, range.to),
        gte(event.endingDate, range.from),
      ),
    )
    .orderBy(asc(event.startingDate));

  return rows.map((row) => ({
    ...row,
    startingDate: new Date(row.startingDate!).toISOString(),
    endingDate: new Date(row.endingDate!).toISOString(),
  }));
}

export async function getCalendarEventById(db: Db, eventId: string) {
  const [row] = await db
    .select({
      id: event.id,
      slug: event.slug,
      name: event.name,
      startingDate: event.startingDate,
      endingDate: event.endingDate,
      coverImageUrl: event.coverImageUrl,
      locationName: location.name,
      locationAddress: location.address,
    })
    .from(event)
    .leftJoin(location, eq(location.id, event.locationId))
    .where(and(eq(event.id, eventId), eq(event.isDeleted, false)))
    .limit(1);

  if (!row?.startingDate || !row.endingDate) return null;

  return {
    ...row,
    startingDate: new Date(row.startingDate).toISOString(),
    endingDate: new Date(row.endingDate).toISOString(),
  } satisfies CalendarEvent;
}
