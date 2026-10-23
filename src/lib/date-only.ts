import { differenceInYears } from 'date-fns';

function localDate(year: number, month: number, day: number): Date | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Acepta YYYY-MM-DD (con hora opcional) y DD/MM/YYYY. Si no se puede leer, devuelve null. */
export function tryDateOnlyToLocalDate(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(trimmed);
  if (iso) {
    return localDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const ymd = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(trimmed);
  if (ymd) {
    return localDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(trimmed);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    return localDate(year, second, first) ?? localDate(year, first, second);
  }

  return null;
}

export function dateOnlyToLocalDate(value: string) {
  const date = tryDateOnlyToLocalDate(value);
  if (!date) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  return date;
}

export function dateToDateOnlyString(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function formatDateOnly(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '-';

  const date = tryDateOnlyToLocalDate(trimmed);
  if (!date) return trimmed;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}

export function ageFromBirthDate(value: string | null | undefined): string {
  const date = tryDateOnlyToLocalDate(value);
  if (!date) return '-';

  const age = differenceInYears(new Date(), date);
  return Number.isFinite(age) && age >= 0 ? String(age) : '-';
}
