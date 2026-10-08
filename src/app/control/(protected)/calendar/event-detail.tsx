import type { CalendarTenant } from '@/server/control/calendar-tenants';

import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { ExternalLink, MapPin, PlayCircle } from 'lucide-react';

import { CALENDAR_TIME_ZONE } from '@/app/control/(protected)/calendar/calendar-params';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  eventPagePath,
  type EventAnalytics,
  getEventAnalytics,
} from '@/server/analytics/event-analytics';
import { getTenantEventDetail } from '@/server/calendar/unified-calendar';

const numberFormat = new Intl.NumberFormat('es-AR');
const percentFormat = new Intl.NumberFormat('es-AR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function formatEventDate(iso: string, pattern: string) {
  return formatInTimeZone(iso, CALENDAR_TIME_ZONE, pattern, { locale: es });
}

export default async function EventDetail({
  tenant,
  eventId,
  tenantUrl,
}: {
  tenant: CalendarTenant;
  eventId: string;
  tenantUrl: string;
}) {
  const detail = await getTenantEventDetail(tenant, eventId);

  if (!detail) {
    return (
      <p className='p-6 text-sm text-gray-600'>
        No encontramos este evento. Puede haber sido eliminado.
      </p>
    );
  }

  const { event, stats } = detail;
  const analytics = await getEventAnalytics({
    instanceKey: tenant.slug,
    eventId: event.id,
    eventSlug: event.slug,
    startingDate: event.startingDate,
  });

  return (
    <div className='space-y-6 p-4'>
      <div className='space-y-3'>
        <p className='text-sm text-gray-700'>
          {formatEventDate(event.startingDate, "EEEE d 'de' MMMM · HH:mm")}
          {' → '}
          {formatEventDate(event.endingDate, 'EEE d MMM · HH:mm')}
        </p>
        {event.locationName && (
          <p className='flex items-start gap-1.5 text-sm text-gray-600'>
            <MapPin className='mt-0.5 size-4 shrink-0' />
            <span>
              {event.locationName}
              {event.locationAddress && ` · ${event.locationAddress}`}
            </span>
          </p>
        )}
        <div className='flex flex-wrap gap-2'>
          <Button asChild size='sm' variant='ghost'>
            <a
              href={`${tenantUrl}${eventPagePath(event.slug)}`}
              target='_blank'
              rel='noreferrer'
            >
              <ExternalLink />
              Página pública
            </a>
          </Button>
          <Button asChild size='sm' variant='ghost'>
            <a
              href={`${tenantUrl}/admin/event/${event.slug}`}
              target='_blank'
              rel='noreferrer'
            >
              <ExternalLink />
              Administrar
            </a>
          </Button>
        </div>
      </div>

      <Section title='Ventas y asistencia'>
        <div className='grid grid-cols-2 gap-3'>
          <Stat
            label='Entradas vendidas'
            value={numberFormat.format(stats.ticketsSold)}
          />
          <Stat label='Recaudado' value={formatCurrency(stats.totalRaised)} />
          <Stat
            label='Entradas emitidas'
            value={numberFormat.format(stats.ticketsIssued)}
          />
          <Stat
            label='Escaneadas'
            value={numberFormat.format(stats.ticketsScanned)}
            hint={`${percentFormat.format(stats.attendanceRate / 100)} de asistencia`}
          />
        </div>
      </Section>

      <Section title='Tráfico de la página'>
        {analytics ? (
          <TrafficAnalytics analytics={analytics} />
        ) : (
          <p className='rounded-xl border border-dashed border-stroke bg-white p-4 text-sm text-gray-600'>
            Para ver visitas, fuentes y replays configurá{' '}
            <code>POSTHOG_PERSONAL_API_KEY</code> y{' '}
            <code>POSTHOG_PROJECT_ID</code>.
          </p>
        )}
      </Section>
    </div>
  );
}

function TrafficAnalytics({ analytics }: { analytics: EventAnalytics }) {
  const checkoutRate =
    analytics.visitors > 0
      ? analytics.checkoutVisitors / analytics.visitors
      : 0;
  const dailyVisitors = analytics.dailyVisitors.slice(-60);
  const maxDaily = Math.max(1, ...dailyVisitors.map((day) => day.visitors));

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3'>
        <Stat
          label='Visitantes únicos'
          value={numberFormat.format(analytics.visitors)}
        />
        <Stat label='Vistas' value={numberFormat.format(analytics.pageviews)} />
        <Stat
          label='Iniciaron checkout'
          value={numberFormat.format(analytics.checkoutVisitors)}
        />
        <Stat
          label='Visitante → checkout'
          value={percentFormat.format(checkoutRate)}
        />
      </div>

      {dailyVisitors.length > 0 && (
        <Card title='Visitantes por día'>
          <div
            className='flex h-24 items-end gap-px'
            role='img'
            aria-label='Visitantes únicos por día'
          >
            {dailyVisitors.map((day) => (
              <div
                key={day.day}
                className='min-w-0 flex-1 rounded-t-sm bg-accent'
                style={{ height: `${(day.visitors / maxDaily) * 100}%` }}
                title={`${formatEventDate(`${day.day}T12:00:00Z`, 'd MMM')}: ${day.visitors}`}
              />
            ))}
          </div>
          <div className='mt-1 flex justify-between text-xs text-gray-500'>
            <span>
              {formatEventDate(`${dailyVisitors[0].day}T12:00:00Z`, 'd MMM')}
            </span>
            <span>
              {formatEventDate(
                `${dailyVisitors[dailyVisitors.length - 1].day}T12:00:00Z`,
                'd MMM',
              )}
            </span>
          </div>
        </Card>
      )}

      <div className='grid gap-3 sm:grid-cols-2'>
        <Card title='Fuentes'>
          <BarList
            items={analytics.sources.map((source) => ({
              ...source,
              label: source.label === '$direct' ? 'Directo' : source.label,
            }))}
          />
        </Card>
        <Card title='Dispositivos'>
          <BarList items={analytics.devices} />
        </Card>
      </div>

      {analytics.recordings.length > 0 && (
        <Card title='Últimas sesiones grabadas'>
          <ul className='space-y-1'>
            {analytics.recordings.map((recording) => (
              <li key={recording.url}>
                <a
                  href={recording.url}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline'
                >
                  <PlayCircle className='size-4' />
                  {formatEventDate(
                    recording.startedAt.replace(' ', 'T'),
                    'd MMM · HH:mm',
                  )}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {analytics.failed.length > 0 && (
        <p className='text-xs text-gray-500'>
          Algunas métricas no se pudieron cargar ({analytics.failed.join(', ')}
          ). El detalle está en PostHog Logs.
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className='space-y-3'>
      <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
      {children}
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-xl border border-stroke bg-white p-4 shadow-sm'>
      <p className='mb-3 text-xs font-medium text-gray-500'>{title}</p>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className='rounded-xl border border-stroke bg-white p-4 shadow-sm'>
      <p className='text-xs font-medium text-gray-500'>{label}</p>
      <p className='mt-1 text-2xl font-bold tabular-nums text-gray-900'>
        {value}
      </p>
      {hint && <p className='mt-0.5 text-xs text-gray-500'>{hint}</p>}
    </div>
  );
}

function BarList({ items }: { items: { label: string; visitors: number }[] }) {
  if (items.length === 0) {
    return <p className='text-sm text-gray-500'>Sin datos todavía.</p>;
  }

  const max = Math.max(...items.map((item) => item.visitors));

  return (
    <ul className='space-y-2'>
      {items.map((item) => (
        <li key={item.label} className='space-y-1'>
          <div className='flex justify-between gap-2 text-sm'>
            <span className='truncate text-gray-700'>{item.label}</span>
            <span className='tabular-nums text-gray-900'>
              {numberFormat.format(item.visitors)}
            </span>
          </div>
          <div className='h-1.5 rounded-full bg-gray-100'>
            <div
              className='h-full rounded-full bg-accent'
              style={{ width: `${(item.visitors / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className='space-y-4 p-4' aria-busy='true'>
      <div className='h-4 w-2/3 animate-pulse rounded bg-gray-200' />
      <div className='grid grid-cols-2 gap-3'>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className='h-20 animate-pulse rounded-xl bg-gray-200'
          />
        ))}
      </div>
      <div className='h-32 animate-pulse rounded-xl bg-gray-200' />
    </div>
  );
}
