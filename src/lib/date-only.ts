export function dateOnlyToLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    !year ||
    !month ||
    !day ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid date-only value: ${value}`);
  }

  return date;
}

export function dateToDateOnlyString(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function formatDateOnly(value: string) {
  const date = dateOnlyToLocalDate(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}
