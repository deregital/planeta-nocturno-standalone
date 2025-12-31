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

export function calculateTotalPriceFromData({
  subtotalPrice,
  serviceFee,
  discountPercentage,
}: {
  subtotalPrice: number;
  serviceFee: number | null | undefined;
  discountPercentage?: number | null;
}): number {
  let serviceFeePrice = 0;
  if (serviceFee) {
    serviceFeePrice = subtotalPrice * (serviceFee / 100);
  }

  const hasDiscount =
    discountPercentage !== null &&
    discountPercentage !== undefined &&
    discountPercentage > 0;
  const subtotalWithDiscount = hasDiscount
    ? subtotalPrice * (1 - discountPercentage / 100)
    : subtotalPrice;

  return subtotalWithDiscount + serviceFeePrice;
}
