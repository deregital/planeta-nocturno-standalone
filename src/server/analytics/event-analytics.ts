import 'server-only';

import { subDays } from 'date-fns';

import {
  isPostHogQueryConfigured,
  posthogProjectUrl,
  queryPostHog,
} from '@/server/analytics/posthog-query';
import { logger } from '@/server/observability/logger';

// Las visitas a la página de un evento empiezan semanas antes de la fecha.
const VISITS_LOOKBACK_DAYS = 120;

export type EventAnalytics = {
  pageviews: number;
  visitors: number;
  checkoutVisitors: number;
  dailyVisitors: { day: string; visitors: number }[];
  sources: { label: string; visitors: number }[];
  devices: { label: string; visitors: number }[];
  recordings: { url: string; startedAt: string }[];
  /** Consultas que fallaron: la sección se muestra igual con lo que haya. */
  failed: string[];
};

export function eventPagePath(eventSlug: string) {
  return `/event/${eventSlug}`;
}

function toHogQLDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Vistas de la página pública del evento dentro de un tenant.
const PAGEVIEW_FILTER = `
  event = '$pageview'
  AND properties.instance_key = {instanceKey}
  AND properties.$pathname = {path}
  AND timestamp >= toDateTime({from}, 'UTC')
`;

/**
 * Visitantes únicos por página de evento, para todos los tenants a la vez.
 * Devuelve un mapa `<instance_key>:<pathname>` → visitantes.
 */
export async function getEventVisitorsByPage(range: {
  from: string;
  to: string;
}): Promise<Map<string, number> | null> {
  if (!isPostHogQueryConfigured()) return null;

  try {
    const rows = await queryPostHog(
      'calendar_event_visitors',
      `
        SELECT
          properties.instance_key AS instance_key,
          properties.$pathname AS pathname,
          count(DISTINCT person_id) AS visitors
        FROM events
        WHERE event = '$pageview'
          AND properties.$pathname LIKE '/event/%'
          AND timestamp >= toDateTime({from}, 'UTC')
          AND timestamp < toDateTime({to}, 'UTC')
        GROUP BY instance_key, pathname
        LIMIT 10000
      `,
      {
        from: toHogQLDateTime(
          subDays(new Date(range.from), VISITS_LOOKBACK_DAYS),
        ),
        to: toHogQLDateTime(new Date(range.to)),
      },
    );

    return new Map(
      rows.map((row) => [
        `${row.instance_key}:${row.pathname}`,
        Number(row.visitors),
      ]),
    );
  } catch (error) {
    logger.warn('Unable to load calendar visitors from PostHog', { error });
    return null;
  }
}

export async function getEventAnalytics(params: {
  instanceKey: string;
  eventId: string;
  eventSlug: string;
  startingDate: string;
}): Promise<EventAnalytics | null> {
  if (!isPostHogQueryConfigured()) return null;

  const values = {
    instanceKey: params.instanceKey,
    eventId: params.eventId,
    path: eventPagePath(params.eventSlug),
    from: toHogQLDateTime(
      subDays(new Date(params.startingDate), VISITS_LOOKBACK_DAYS),
    ),
  };
  const failed: string[] = [];

  async function run<T>(
    name: string,
    query: string,
    map: (rows: Record<string, unknown>[]) => T,
    fallback: T,
  ) {
    try {
      return map(await queryPostHog(name, query, values));
    } catch (error) {
      failed.push(name);
      logger.warn('PostHog event analytics query failed', {
        query: name,
        instance_key: params.instanceKey,
        event_id: params.eventId,
        error,
      });
      return fallback;
    }
  }

  // PostHog permite 3 consultas en paralelo por proyecto.
  const [totals, dailyVisitors, breakdown] = await Promise.all([
    run(
      'event_totals',
      `
        SELECT
          countIf(event = '$pageview') AS pageviews,
          uniqIf(person_id, event = '$pageview') AS visitors,
          uniqIf(person_id, event = 'checkout_submitted') AS checkout_visitors
        FROM events
        WHERE properties.instance_key = {instanceKey}
          AND timestamp >= toDateTime({from}, 'UTC')
          AND (
            (event = '$pageview' AND properties.$pathname = {path})
            OR (event = 'checkout_submitted' AND properties.event_id = {eventId})
          )
      `,
      ([row]) => ({
        pageviews: Number(row?.pageviews ?? 0),
        visitors: Number(row?.visitors ?? 0),
        checkoutVisitors: Number(row?.checkout_visitors ?? 0),
      }),
      { pageviews: 0, visitors: 0, checkoutVisitors: 0 },
    ),
    run(
      'event_daily_visitors',
      `
        SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS visitors
        FROM events
        WHERE ${PAGEVIEW_FILTER}
        GROUP BY day
        ORDER BY day
      `,
      (rows) =>
        rows.map((row) => ({
          day: String(row.day),
          visitors: Number(row.visitors),
        })),
      [],
    ),
    run(
      'event_sources_devices',
      `
        SELECT
          'source' AS kind,
          coalesce(
            nullIf(properties.utm_source, ''),
            nullIf(properties.$referring_domain, ''),
            '$direct'
          ) AS label,
          count(DISTINCT person_id) AS visitors
        FROM events
        WHERE ${PAGEVIEW_FILTER}
        GROUP BY label
        UNION ALL
        SELECT
          'device' AS kind,
          coalesce(properties.$device_type, 'Desconocido') AS label,
          count(DISTINCT person_id) AS visitors
        FROM events
        WHERE ${PAGEVIEW_FILTER}
        GROUP BY label
      `,
      (rows) => rows,
      [] as Record<string, unknown>[],
    ),
  ]);

  const recordings = await run(
    'event_recordings',
    `
      SELECT session_id, min(start_time) AS started_at
      FROM session_replay_events
      WHERE session_id IN (
        SELECT DISTINCT $session_id FROM events WHERE ${PAGEVIEW_FILTER}
      )
      GROUP BY session_id
      ORDER BY started_at DESC
      LIMIT 5
    `,
    (rows) =>
      rows.flatMap((row) => {
        const url = posthogProjectUrl(`/replay/${row.session_id}`);
        return url ? [{ url, startedAt: String(row.started_at) }] : [];
      }),
    [],
  );

  const byKind = (kind: string) =>
    breakdown
      .filter((row) => row.kind === kind)
      .map((row) => ({
        label: String(row.label),
        visitors: Number(row.visitors),
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 6);

  return {
    ...totals,
    dailyVisitors,
    sources: byKind('source'),
    devices: byKind('device'),
    recordings,
    failed,
  };
}
