import { format, isValid, type Locale } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

function fallbackDateLabel(value: string | Date): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '-';
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

/** Formatea una fecha con zona horaria. Si el valor no es una fecha, devuelve el texto original. */
export function formatZonedDateTime(
  value: string | Date | null | undefined,
  timeZone: string,
  pattern: string,
): string {
  if (value == null || value === '') return '-';
  const date = toValidDate(value);
  if (!date) return fallbackDateLabel(value);

  try {
    return formatInTimeZone(date, timeZone, pattern);
  } catch {
    return fallbackDateLabel(value);
  }
}

/** Formatea una fecha local. Si el valor no es una fecha, devuelve el texto original. */
export function formatLocalDateTime(
  value: string | Date | null | undefined,
  pattern: string,
  options?: { locale?: Locale },
): string {
  if (value == null || value === '') return '-';
  const date = toValidDate(value);
  if (!date) return fallbackDateLabel(value);

  try {
    return format(date, pattern, options);
  } catch {
    return fallbackDateLabel(value);
  }
}
