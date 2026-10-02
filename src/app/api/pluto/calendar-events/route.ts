import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import { verifySignedRequest } from '@/server/security/signed-request';
import { getCalendarEvents } from '@/server/services/calendarEvents';
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
    // Pluto espera siempre una ubicación: se omiten los eventos sin lugar.
    const events = (
      await getCalendarEvents(db, { from: body.from, to: body.to })
    ).filter((eventItem) => eventItem.locationName !== null);

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
        startingDate: eventItem.startingDate,
        endingDate: eventItem.endingDate,
        locationName: eventItem.locationName,
        locationAddress: eventItem.locationAddress,
        coverImageUrl: eventItem.coverImageUrl,
        stats: eventStats.get(eventItem.id),
      })),
    });
  } catch (error) {
    logger.error('[api/pluto/calendar-events] Unable to fetch events', {
      error,
    });
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
