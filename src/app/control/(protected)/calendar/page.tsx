import type { UnifiedCalendarEvent } from '@/server/calendar/unified-calendar';
import type { CalendarTenant } from '@/server/control/calendar-tenants';

import { es } from 'date-fns/locale';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Eye, TriangleAlert } from 'lucide-react';
import { type Route } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';

import {
  CALENDAR_TIME_ZONE,
  calendarHref,
  monthGrid,
  parseCalendarParams,
  shiftMonth,
} from '@/app/control/(protected)/calendar/calendar-params';
import EventDetail, {
  EventDetailSkeleton,
  formatEventDate,
} from '@/app/control/(protected)/calendar/event-detail';
import EventDetailSheet from '@/app/control/(protected)/calendar/event-detail-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  eventPagePath,
  getEventVisitorsByPage,
} from '@/server/analytics/event-analytics';
import { isPostHogQueryConfigured } from '@/server/analytics/posthog-query';
import { getUnifiedCalendar } from '@/server/calendar/unified-calendar';
import { getCalendarTenants } from '@/server/control/calendar-tenants';
import { requireAnyPermissionOrRedirect } from '@/server/control/can-manage-tenants';
import { TENANT_READ_PERMISSIONS } from '@/server/control/tenant-access';
import { getTenantPublicUrl } from '@/server/control/tenant-public-url';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function tenantColor(tenant: CalendarTenant | undefined) {
  return tenant
    ? `hsl(${tenant.hue} ${tenant.saturation}% 40%)`
    : 'hsl(0 0% 40%)';
}

export default async function ControlCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session, permissions } = await requireAnyPermissionOrRedirect(
    TENANT_READ_PERMISSIONS,
    '/' as Route,
  );
  const today = toZonedTime(new Date(), CALENDAR_TIME_ZONE);
  const params = parseCalendarParams(await searchParams, today);
  const { days, range } = monthGrid(params.month);

  const tenants = await getCalendarTenants(session.user.id, permissions);
  const tenantBySlug = new Map(tenants.map((tenant) => [tenant.slug, tenant]));
  const filteredTenants = params.tenant
    ? tenants.filter((tenant) => tenant.slug === params.tenant)
    : tenants;

  const [{ events, failedTenants }, visitorsByPage] = await Promise.all([
    getUnifiedCalendar(filteredTenants, range),
    getEventVisitorsByPage(range),
  ]);

  const eventsByDay = new Map<string, UnifiedCalendarEvent[]>();
  for (const event of events) {
    // Un evento que empezó antes de la grilla se muestra en su primer día visible.
    const start =
      event.startingDate < range.from ? range.from : event.startingDate;
    const day = formatInTimeZone(start, CALENDAR_TIME_ZONE, 'yyyy-MM-dd');
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), event]);
  }

  const visitorsOf = (event: UnifiedCalendarEvent) =>
    visitorsByPage?.get(`${event.tenantSlug}:${eventPagePath(event.slug)}`);

  const selectedTenant = params.event
    ? tenantBySlug.get(params.event.tenantSlug)
    : undefined;
  const selectedEvent = params.event
    ? events.find(
        (event) =>
          event.id === params.event!.eventId &&
          event.tenantSlug === params.event!.tenantSlug,
      )
    : undefined;

  const monthLabel = formatInTimeZone(
    `${params.month}-15T12:00:00Z`,
    CALENDAR_TIME_ZONE,
    'MMMM yyyy',
    { locale: es },
  );
  const todayKey = formatInTimeZone(
    new Date(),
    CALENDAR_TIME_ZONE,
    'yyyy-MM-dd',
  );
  const daysWithEvents = days.filter((day) => eventsByDay.has(day));

  return (
    <div className='min-w-0 space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-accent'>Panel central</p>
          <h1 className='text-2xl font-bold text-gray-900 sm:text-3xl'>
            Calendario
          </h1>
          <p className='mt-1 text-sm text-gray-600'>
            {events.length} eventos · {filteredTenants.length}{' '}
            {filteredTenants.length === 1 ? 'plataforma' : 'plataformas'}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button asChild variant='ghost' size='icon' aria-label='Mes anterior'>
            <Link
              href={calendarHref(params, {
                month: shiftMonth(params.month, -1),
                event: null,
              })}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <p className='min-w-36 text-center font-semibold capitalize text-gray-900'>
            {monthLabel}
          </p>
          <Button
            asChild
            variant='ghost'
            size='icon'
            aria-label='Mes siguiente'
          >
            <Link
              href={calendarHref(params, {
                month: shiftMonth(params.month, 1),
                event: null,
              })}
            >
              <ChevronRight />
            </Link>
          </Button>
          <Button asChild variant='ghost' size='sm'>
            <Link
              href={calendarHref(params, {
                month: formatInTimeZone(
                  new Date(),
                  CALENDAR_TIME_ZONE,
                  'yyyy-MM',
                ),
                event: null,
              })}
            >
              Hoy
            </Link>
          </Button>
        </div>
      </div>

      {tenants.length > 1 && (
        <nav
          aria-label='Filtrar por plataforma'
          className='flex flex-wrap gap-2'
        >
          <TenantChip
            href={calendarHref(params, { tenant: null, event: null })}
            active={!params.tenant}
            label='Todas'
          />
          {tenants.map((tenant) => (
            <TenantChip
              key={tenant.slug}
              href={calendarHref(params, { tenant: tenant.slug, event: null })}
              active={params.tenant === tenant.slug}
              label={tenant.name}
              color={tenantColor(tenant)}
            />
          ))}
        </nav>
      )}

      {failedTenants.length > 0 && (
        <p className='flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>
          <TriangleAlert className='mt-0.5 size-4 shrink-0' />
          No se pudieron cargar los eventos de{' '}
          {failedTenants.map((tenant) => tenant.name).join(', ')}.
        </p>
      )}

      {!isPostHogQueryConfigured() && (
        <p className='text-xs text-gray-500'>
          Las visitas de cada evento aparecen al configurar{' '}
          <code>POSTHOG_PERSONAL_API_KEY</code> y{' '}
          <code>POSTHOG_PROJECT_ID</code>.
        </p>
      )}

      {/* Desktop: grilla mensual */}
      <div className='hidden overflow-hidden rounded-xl border border-stroke bg-white shadow-sm md:block'>
        <div className='grid grid-cols-7 border-b border-stroke bg-gray-50'>
          {WEEKDAYS.map((weekday) => (
            <p
              key={weekday}
              className='px-2 py-2 text-xs font-medium text-gray-500'
            >
              {weekday}
            </p>
          ))}
        </div>
        <div className='grid grid-cols-7'>
          {days.map((day) => {
            const inMonth = day.startsWith(params.month);
            return (
              <div
                key={day}
                className={cn(
                  'min-h-28 min-w-0 border-b border-r border-stroke p-1.5 [&:nth-child(7n)]:border-r-0',
                  !inMonth && 'bg-gray-50',
                )}
              >
                <p
                  className={cn(
                    'mb-1 flex size-6 items-center justify-center rounded-full text-xs',
                    inMonth ? 'text-gray-700' : 'text-gray-400',
                    day === todayKey &&
                      'bg-accent-dark font-semibold text-white',
                  )}
                >
                  {Number(day.slice(8))}
                </p>
                <div className='space-y-1'>
                  {(eventsByDay.get(day) ?? []).map((event) => (
                    <EventChip
                      key={`${event.tenantSlug}:${event.id}`}
                      event={event}
                      tenant={tenantBySlug.get(event.tenantSlug)}
                      visitors={visitorsOf(event)}
                      href={calendarHref(params, {
                        event: {
                          tenantSlug: event.tenantSlug,
                          eventId: event.id,
                        },
                      })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: agenda por día */}
      <div className='space-y-4 md:hidden'>
        {daysWithEvents.length === 0 ? (
          <p className='rounded-xl border border-stroke bg-white p-8 text-center text-sm text-gray-500'>
            No hay eventos este mes.
          </p>
        ) : (
          daysWithEvents.map((day) => (
            <section key={day} className='space-y-2'>
              <h2 className='text-sm font-semibold capitalize text-gray-900'>
                {formatEventDate(`${day}T12:00:00Z`, "EEEE d 'de' MMMM")}
              </h2>
              {eventsByDay.get(day)!.map((event) => (
                <EventChip
                  key={`${event.tenantSlug}:${event.id}`}
                  event={event}
                  tenant={tenantBySlug.get(event.tenantSlug)}
                  visitors={visitorsOf(event)}
                  href={calendarHref(params, {
                    event: { tenantSlug: event.tenantSlug, eventId: event.id },
                  })}
                  large
                />
              ))}
            </section>
          ))
        )}
      </div>

      {params.event && selectedTenant && (
        <EventDetailSheet
          title={selectedEvent?.name ?? 'Evento'}
          description={selectedTenant.name}
          closeHref={calendarHref(params, { event: null })}
        >
          <Suspense
            key={`${params.event.tenantSlug}:${params.event.eventId}`}
            fallback={<EventDetailSkeleton />}
          >
            <EventDetail
              tenant={selectedTenant}
              eventId={params.event.eventId}
              tenantUrl={getTenantPublicUrl(
                selectedTenant.slug,
                new Headers(await headers()),
              )}
            />
          </Suspense>
        </EventDetailSheet>
      )}
    </div>
  );
}

function TenantChip({
  href,
  active,
  label,
  color,
}: {
  href: Route;
  active: boolean;
  label: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-accent-dark bg-accent-dark text-white'
          : 'border-stroke bg-white text-gray-700 hover:border-accent',
      )}
    >
      {color && (
        <span
          className='size-2.5 rounded-full'
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </Link>
  );
}

function EventChip({
  event,
  tenant,
  visitors,
  href,
  large = false,
}: {
  event: UnifiedCalendarEvent;
  tenant: CalendarTenant | undefined;
  visitors: number | undefined;
  href: Route;
  large?: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={`${event.name} · ${tenant?.name ?? event.tenantSlug}`}
      className={cn(
        'block min-w-0 rounded-md border-l-4 bg-gray-50 transition-colors hover:bg-gray-100',
        large ? 'border border-stroke bg-white p-3 shadow-sm' : 'px-1.5 py-1',
      )}
      style={{ borderLeftColor: tenantColor(tenant) }}
    >
      <p
        className={cn(
          'truncate font-medium text-gray-900',
          large ? 'text-sm' : 'text-xs',
        )}
      >
        {event.name}
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 truncate text-gray-500',
          large ? 'text-xs' : 'text-[11px]',
        )}
      >
        <span>{formatEventDate(event.startingDate, 'HH:mm')}</span>
        {large && <span className='truncate'>· {tenant?.name}</span>}
        {visitors !== undefined && (
          <span className='inline-flex items-center gap-0.5'>
            <Eye className='size-3' />
            {visitors}
          </span>
        )}
      </p>
    </Link>
  );
}
