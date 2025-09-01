import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEventDate(dateString: string) {
  const date = new Date(dateString);

  return {
    day: format(date, 'dd', { locale: es }),
    month: format(date, 'MMM', { locale: es }),
    year: format(date, 'yyyy', { locale: es }),
    time: format(date, 'HH:mm', { locale: es }),
    dayOfWeek: format(date, 'EEE', { locale: es }),
  };
}

export function daysUntilBirthday(dateStr: string): number {
  const today = new Date();
  const birthDate = new Date(dateStr);

  const thisYear = new Date(
    today.getFullYear(),
    birthDate.getMonth(),
    birthDate.getDate(),
  );
  const nextYear = new Date(
    today.getFullYear() + 1,
    birthDate.getMonth(),
    birthDate.getDate(),
  );

  const nextBirthday = thisYear >= today ? thisYear : nextYear;

  const diff = nextBirthday.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
