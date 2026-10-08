import 'server-only';

import type { CalendarTenant } from '@/server/control/calendar-tenants';

import { getInstanceDb } from '@/server/instance/get-instance-db';
import { logger } from '@/server/observability/logger';
import {
  type CalendarEvent,
  getCalendarEventById,
  getCalendarEvents,
} from '@/server/services/calendarEvents';
import { getCalendarStatsByEventId } from '@/server/services/calendarEventStats';

// Cada base de tenant abre su propio pool: se consultan de a pocas a la vez.
const TENANT_CONCURRENCY = 5;

export type UnifiedCalendarEvent = CalendarEvent & { tenantSlug: string };

/**
 * Junta los eventos de varios tenants. Cada tenant se consulta en su propia
 * base; si uno falla, el resto se muestra igual y se informa cuál falló.
 */
export async function getUnifiedCalendar(
  tenants: CalendarTenant[],
  range: { from: string; to: string },
) {
  const results = await mapWithConcurrency(
    tenants,
    TENANT_CONCURRENCY,
    async (tenant) => {
      try {
        const db = await getInstanceDb({ name: tenant.databaseName });
        const events = await getCalendarEvents(db, range);
        return { tenant, events, failed: false };
      } catch (error) {
        logger.error('Unable to load tenant calendar events', {
          instance_key: tenant.slug,
          error,
        });
        return { tenant, events: [], failed: true };
      }
    },
  );

  const events: UnifiedCalendarEvent[] = results
    .flatMap(({ tenant, events: tenantEvents }) =>
      tenantEvents.map((event) => ({ ...event, tenantSlug: tenant.slug })),
    )
    .sort((a, b) => a.startingDate.localeCompare(b.startingDate));

  return {
    events,
    failedTenants: results
      .filter((result) => result.failed)
      .map((result) => result.tenant),
  };
}

export async function getTenantEventDetail(
  tenant: CalendarTenant,
  eventId: string,
) {
  const db = await getInstanceDb({ name: tenant.databaseName });
  const event = await getCalendarEventById(db, eventId);
  if (!event) return null;

  return { event, stats: await getCalendarStatsByEventId(db, event.id) };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}
