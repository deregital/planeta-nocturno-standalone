import { asc, and, eq, gte, lte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { event, location } from '@/drizzle/schema';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { verifySignedRequest } from '@/server/security/signed-request';
import { getCalendarStatsByEventId } from '@/server/services/calendarEventStats';

const calendarEventsRequestSchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((value) => new Date(value.from) <= new Date(value.to), {
    message: 'from must be before or equal to to',
    path: ['from'],
  });

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

export async function POST(request: Request) {
  const signedRequest = await verifySignedRequest(request, {
    logPrefix: '[api/pluto/calendar-events]',
  });

  if (!signedRequest.ok) {
    return signedRequest.response;
  }

  let body: z.infer<typeof calendarEventsRequestSchema>;
  try {
    body = calendarEventsRequestSchema.parse(JSON.parse(signedRequest.rawBody));
  } catch {
    return NextResponse.json(
      { success: false, error: 'BAD_REQUEST', message: 'Body inválido.' },
      { status: 400 },
    );
  }

  try {
    const { db, instance } = await resolveRequestContext(request.headers);
    const events = await db
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
      .innerJoin(location, eq(location.id, event.locationId))
      .where(
        and(
          eq(event.isActive, true),
          eq(event.isDeleted, false),
          lte(event.startingDate, body.to),
          gte(event.endingDate, body.from),
        ),
      )
      .orderBy(asc(event.startingDate));

    const eventStats = new Map();
    for (const eventItem of events) {
      eventStats.set(
        eventItem.id,
        await getCalendarStatsByEventId(db, eventItem.id),
      );
    }

    return NextResponse.json({
      success: true,
      instance: {
        name: instance.name,
        url: instance.publicUrl,
      },
      events: events.map((eventItem) => ({
        id: eventItem.id,
        slug: eventItem.slug,
        name: eventItem.name,
        startingDate: toIsoDateTime(eventItem.startingDate),
        endingDate: toIsoDateTime(eventItem.endingDate),
        locationName: eventItem.locationName,
        locationAddress: eventItem.locationAddress,
        coverImageUrl: eventItem.coverImageUrl,
        stats: eventStats.get(eventItem.id),
      })),
    });
  } catch (error) {
    console.error('[api/pluto/calendar-events] Unable to fetch events', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DATA_UNAVAILABLE',
        message: 'No pudimos obtener los eventos de esta instancia.',
      },
      { status: 502 },
    );
  }
}
