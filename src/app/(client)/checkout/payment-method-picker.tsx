'use client';

import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

export type CheckoutPaymentOption =
  RouterOutputs['payments']['checkoutOptions'][number];

/** Elección del medio de pago. Se muestra sólo con dos o más medios activos. */
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
    <fieldset className='mt-8 flex min-w-0 flex-col gap-3'>
      <legend className='mb-3 text-lg font-semibold'>
        ¿Cómo querés pagar?
      </legend>
      {options.map((option) => (
        <label
          key={option.method}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-md border-2 border-stroke p-4',
            'has-[:checked]:border-accent has-[:checked]:bg-accent-ultra-light',
            'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
          )}
        >
          <input
            type='radio'
            name='paymentMethod'
            value={option.method}
            defaultChecked={option.method === selected}
            className='mt-1 size-5 shrink-0 accent-accent'
          />
          <span className='flex min-w-0 flex-col gap-1'>
            <span className='font-semibold'>{option.label}</span>
            <span className='text-sm text-muted-foreground'>
              {option.description}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
