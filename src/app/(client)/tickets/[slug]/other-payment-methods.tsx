'use client';

import type { PaymentMethod } from '@/server/types';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { startPaymentFor } from '@/app/(client)/tickets/[slug]/actions';
import { Button } from '@/components/ui/button';

type Method = Exclude<PaymentMethod, 'ON_SITE'>;

/** Botones para pagar la misma reserva con otro medio. */
export function OtherPaymentMethods({
  ticketGroupId,
  methods,
}: {
  ticketGroupId: string;
  methods: { method: Method; label: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Method | null>(null);
  const [, startTransition] = useTransition();

  if (methods.length === 0) return null;

  const payWith = (method: Method) => {
    setError(null);
    setPending(method);
    startTransition(async () => {
      const result = await startPaymentFor(ticketGroupId, method);
      if ('url' in result) {
        window.location.href = result.url;
        return;
      }
      setPending(null);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className='flex w-full flex-col gap-2 border-t border-stroke pt-4'>
      <p className='text-sm font-medium'>¿Preferís pagar de otra forma?</p>
      {methods.map(({ method, label }) => (
        <Button
          key={method}
          type='button'
          variant='outline'
          className='w-full whitespace-normal'
          disabled={pending !== null}
          loading={pending === method}
          onClick={() => payWith(method)}
        >
          Pagar con {label}
        </Button>
      ))}
      {error && (
        <p role='alert' className='text-sm font-medium text-red-500'>
          {error}
        </p>
      )}
    </div>
  );
}
