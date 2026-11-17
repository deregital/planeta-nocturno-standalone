'use client';

import {
  PAYMENT_BRANDS,
  PaymentMethodIcon,
} from '@/components/payments/payment-brand';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

export type CheckoutPaymentOption =
  RouterOutputs['payments']['checkoutOptions'][number];

/**
 * Elección del medio de pago: el ícono primero y el nombre abajo, con el
 * color de cada medio al elegirlo. Se muestra sólo con dos o más medios.
 */
export function PaymentMethodPicker({
  options,
  defaultValue,
}: {
  options: CheckoutPaymentOption[];
  defaultValue?: string;
}) {
  const selected =
    options.find((option) => option.method === defaultValue)?.method ??
    options[0]?.method;

  return (
    <fieldset className='mt-8 flex min-w-0 flex-col'>
      <legend className='mb-3 text-lg font-semibold'>
        ¿Cómo querés pagar?
      </legend>
      <div
        className={cn(
          'grid gap-2',
          options.length >= 3 ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {options.map((option) => (
          <label
            key={option.method}
            className={cn(
              'flex min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-stroke bg-white px-2 py-3 text-center',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
              PAYMENT_BRANDS[option.method].selected,
            )}
          >
            <input
              type='radio'
              name='paymentMethod'
              value={option.method}
              defaultChecked={option.method === selected}
              className='sr-only'
            />
            <PaymentMethodIcon method={option.method} className='size-10' />
            <span className='text-xs leading-tight font-medium break-words sm:text-sm'>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
