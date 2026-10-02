import { type Route } from 'next';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

export const CALENDAR_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export type CalendarParams = {
  month: string;
  tenant: string | null;
  event: { tenantSlug: string; eventId: string } | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCalendarParams(
  searchParams: RawSearchParams,
  today: Date,
): CalendarParams {
  const rawMonth = first(searchParams.month);
  const parsedMonth = rawMonth ? parse(rawMonth, 'yyyy-MM', today) : null;
  const month =
    parsedMonth && isValid(parsedMonth)
      ? format(parsedMonth, 'yyyy-MM')
      : format(today, 'yyyy-MM');

  // `event=<tenant>:<eventId>`: los slugs de tenant no pueden tener ':'.
  const [tenantSlug, eventId] = (first(searchParams.event) ?? '').split(':');

  return {
    month,
    tenant: first(searchParams.tenant) || null,
    event: tenantSlug && eventId ? { tenantSlug, eventId } : null,
  };
}

export function calendarHref(
  params: CalendarParams,
  changes: Partial<CalendarParams> = {},
) {
  const next = { ...params, ...changes };
  const search = new URLSearchParams({ month: next.month });
  if (next.tenant) search.set('tenant', next.tenant);
  if (next.event) {
    search.set('event', `${next.event.tenantSlug}:${next.event.eventId}`);
  }
  return `/calendar?${search.toString()}` as Route;
}

export function shiftMonth(month: string, amount: number) {
  return format(
    addMonths(parse(month, 'yyyy-MM', new Date()), amount),
    'yyyy-MM',
  );
}

/** Días visibles (semanas completas de lunes a domingo) y su rango en UTC. */
export function monthGrid(month: string) {
  const monthDate = parse(month, 'yyyy-MM', new Date());
  const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd }).map(
    (day) => format(day, 'yyyy-MM-dd'),
  );

  return {
    days,
    range: {
      from: fromZonedTime(
        `${days[0]}T00:00:00`,
        CALENDAR_TIME_ZONE,
      ).toISOString(),
      to: fromZonedTime(
        `${days[days.length - 1]}T23:59:59`,
        CALENDAR_TIME_ZONE,
      ).toISOString(),
    },
  };
}
