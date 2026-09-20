import { isAfter, isBefore, isValid } from 'date-fns';

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

/** Sin fecha de fin = el evento no se considera finalizado. */
export function isEventFinished(endingDate: DateInput): boolean {
  const date = toDate(endingDate);
  if (!date) return false;
  return !isAfter(date, new Date());
}

/** Sin fecha de fin = se trata como próximo / vigente. */
export function isEventUpcoming(endingDate: DateInput): boolean {
  return !isEventFinished(endingDate);
}

export function isEventPast(endingDate: DateInput): boolean {
  const date = toDate(endingDate);
  if (!date) return false;
  return isBefore(date, new Date());
}

export function toNullableIsoString(
  date: Date | null | undefined,
): string | null {
  return date ? date.toISOString() : null;
}

export function formatEventDateRange(
  startingDate: DateInput,
  endingDate: DateInput,
  formatFn: (date: Date, pattern: string) => string,
): string | null {
  const start = toDate(startingDate);
  const end = toDate(endingDate);

  if (!start && !end) return null;
  if (start && end) {
    return `${formatFn(start, 'dd/MM/yyyy HH:mm')} → ${formatFn(end, 'dd/MM/yyyy HH:mm')}`;
  }
  if (start) return `Inicio ${formatFn(start, 'dd/MM/yyyy HH:mm')}`;
  return `Fin ${formatFn(end!, 'dd/MM/yyyy HH:mm')}`;
}
