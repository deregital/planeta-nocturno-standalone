import { NextResponse } from 'next/server';
import { z } from 'zod';

import { PLUTO_NIGHT_METRICS_ACTION } from '@/lib/pluto/instance-api';
import { logger } from '@/server/observability/logger';
import {
  getCodeVersion,
  getPlutoInstance,
} from '@/server/pluto/instance-tenants';
import { readSignedPlutoBody } from '@/server/pluto/signed-body';
import {
  getNightMetrics,
  type NightMetrics,
} from '@/server/services/nightMetrics';
import { mapWithConcurrency } from '@/server/utils/map-with-concurrency';

const LOG_PREFIX = '[api/pluto/night-metrics]';
const MAX_EVENTS = 50;
const TENANT_CONCURRENCY = 5;

const nightMetricsRequestSchema = z.object({
  action: z.literal(PLUTO_NIGHT_METRICS_ACTION),
  events: z
    .array(
      z.object({
        /** `null` en una instancia de una sola productora. */
        tenant: z.string().min(1).nullable(),
        eventId: z.uuid(),
      }),
    )
    .min(1)
    .max(MAX_EVENTS),
});

type ResultError = 'TENANT_NOT_FOUND' | 'EVENT_NOT_FOUND' | 'DATA_UNAVAILABLE';

/** Pluto recibe sólo totales: el desglose por organizador lleva nombres. */
function forPluto({ byOrganizer: _byOrganizer, ...metrics }: NightMetrics) {
  return metrics;
}

/**
 * Las métricas de la noche de los eventos que pide Pluto, de cualquier
 * productora de la instancia. Cada evento vuelve con sus métricas o con el
 * motivo por el que no se pudieron calcular.
 */
export async function POST(request: Request) {
  const signed = await readSignedPlutoBody(
    request,
    nightMetricsRequestSchema,
    LOG_PREFIX,
  );
  if (!signed.ok) return signed.response;
  const requested = signed.body.events;

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

  const eventIdsByTenant = new Map<string | null, string[]>();
  for (const { tenant, eventId } of requested) {
    eventIdsByTenant.set(tenant, [
      ...(eventIdsByTenant.get(tenant) ?? []),
      eventId,
    ]);
  }

  const tenantsBySlug = new Map(
    instance.tenants.map((tenant) => [tenant.slug, tenant]),
  );
  const metricsByTenant = new Map<
    string | null,
    Map<string, NightMetrics> | ResultError
  >();

  await mapWithConcurrency(
    [...eventIdsByTenant.entries()],
    TENANT_CONCURRENCY,
    async ([slug, eventIds]) => {
      const tenant = tenantsBySlug.get(slug);
      if (!tenant) {
        metricsByTenant.set(slug, 'TENANT_NOT_FOUND');
        return;
      }
      try {
        const metrics = await getNightMetrics(await tenant.getDb(), eventIds);
        metricsByTenant.set(
          slug,
          new Map(metrics.map((item) => [item.event.id, item])),
        );
      } catch (error) {
        logger.error(`${LOG_PREFIX} Unable to compute night metrics`, {
          instance_key: slug,
          error,
        });
        metricsByTenant.set(slug, 'DATA_UNAVAILABLE');
      }
    },
  );

  return NextResponse.json({
    success: true,
    version: getCodeVersion(),
    results: requested.map(({ tenant, eventId }) => {
      const tenantMetrics = metricsByTenant.get(tenant);
      if (typeof tenantMetrics === 'string') {
        return { tenant, eventId, error: tenantMetrics };
      }
      const metrics = tenantMetrics?.get(eventId);
      return metrics
        ? { tenant, eventId, metrics: forPluto(metrics) }
        : { tenant, eventId, error: 'EVENT_NOT_FOUND' satisfies ResultError };
    }),
  });
}
