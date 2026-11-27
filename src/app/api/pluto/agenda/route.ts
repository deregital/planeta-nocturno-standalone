import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PLUTO_AGENDA_ACTION } from '@/lib/pluto/instance-api';
import { logger } from '@/server/observability/logger';
import {
  getCodeVersion,
  getPlutoInstance,
} from '@/server/pluto/instance-tenants';
import { readSignedPlutoBody } from '@/server/pluto/signed-body';
import { getCalendarEvents } from '@/server/services/calendarEvents';
import { mapWithConcurrency } from '@/server/utils/map-with-concurrency';

const LOG_PREFIX = '[api/pluto/agenda]';
const MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;
// Cada base de tenant abre su propio pool: se consultan de a pocas a la vez.
const TENANT_CONCURRENCY = 5;

const agendaRequestSchema = z
  .object({
    action: z.literal(PLUTO_AGENDA_ACTION),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((value) => new Date(value.from) <= new Date(value.to), {
    message: 'from must be before or equal to to',
    path: ['from'],
  })
  .refine(
    (value) =>
      new Date(value.to).getTime() - new Date(value.from).getTime() <=
      MAX_RANGE_MS,
    { message: 'range is too long', path: ['to'] },
  );

/**
 * La agenda de la instancia entera para Pluto: los eventos de cada productora
 * (publicados o no, sin los borrados) que se superponen con [from, to]. Si una productora falla, el
 * resto se devuelve igual y la que falló va en `failedTenants`.
 */
export async function POST(request: Request) {
  const signed = await readSignedPlutoBody(
    request,
    agendaRequestSchema,
    LOG_PREFIX,
  );
  if (!signed.ok) return signed.response;
  const range = { from: signed.body.from, to: signed.body.to };

  let instance;
  try {
    instance = await getPlutoInstance(request.headers);
  } catch (error) {
    logger.error(`${LOG_PREFIX} Unable to list tenants`, { error });
    return NextResponse.json(
      {
        success: false,
        error: 'DATA_UNAVAILABLE',
        message: 'No pudimos obtener las productoras de esta instancia.',
      },
      { status: 502 },
    );
  }

  const results = await mapWithConcurrency(
    instance.tenants,
    TENANT_CONCURRENCY,
    async (tenant) => {
      try {
        // También las no publicadas: las de invitación nunca se publican y
        // son noches con puerta igual.
        const events = await getCalendarEvents(await tenant.getDb(), range, {
          includeUnpublished: true,
        });
        return { tenant, events };
      } catch (error) {
        logger.error(`${LOG_PREFIX} Unable to fetch tenant events`, {
          instance_key: tenant.slug,
          error,
        });
        return { tenant, events: null };
      }
    },
  );

  return NextResponse.json({
    success: true,
    instance: {
      mode: instance.mode,
      name: instance.name,
      url: instance.url,
      version: getCodeVersion(),
    },
    tenants: results
      .filter((result) => result.events !== null)
      .map(({ tenant, events }) => ({
        slug: tenant.slug,
        name: tenant.name,
        url: tenant.url,
        events: events!.map((eventItem) => ({
          id: eventItem.id,
          slug: eventItem.slug,
          name: eventItem.name,
          startingDate: eventItem.startingDate,
          endingDate: eventItem.endingDate,
          locationName: eventItem.locationName,
          locationAddress: eventItem.locationAddress,
          coverImageUrl: eventItem.coverImageUrl,
          isActive: eventItem.isActive,
          inviteCondition: eventItem.inviteCondition,
        })),
      })),
    failedTenants: results
      .filter((result) => result.events === null)
      .map(({ tenant }) => ({ slug: tenant.slug, name: tenant.name })),
  });
}
