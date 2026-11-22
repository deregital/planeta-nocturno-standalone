'use client';

import { type Route } from 'next';
import { Loader2, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  type VerifyHolderResult,
  verifyTicketHolder,
} from '@/app/(client)/tickets/[slug]/access-actions';
import GoBack from '@/components/common/GoBack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERRORS: Record<Exclude<VerifyHolderResult['status'], 'ok'>, string> = {
  invalid: 'El DNI no coincide con el de ningún titular de este ticket.',
  rate_limited:
    'Hiciste demasiados intentos. Esperá un rato y volvé a intentar.',
  error: 'No pudimos verificar tus datos. Intentá nuevamente.',
};

/**
 * Pide el DNI de un titular antes de mostrar un ticket. Lo usan el link de la
 * compra (`/tickets/[id]`) y el de una invitación ya usada.
 */
export default function TicketHolderVerify({
  title,
  description,
  invalidMessage = ERRORS.invalid,
  verify,
}: {
  title: string;
  description: string;
  invalidMessage?: string;
  verify: (dni: string) => Promise<VerifyHolderResult>;
}) {
  const router = useRouter();
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dni.trim() || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await verify(dni);
      if (result.status === 'ok') {
        // Con la cookie puesta, la misma página ya muestra el ticket.
        router.replace(`/tickets/${result.ticketGroupId}` as Route);
        router.refresh();
        return;
      }
      setError(
        result.status === 'invalid' ? invalidMessage : ERRORS[result.status],
      );
    });
  }

  return (
    <div className='flex justify-center px-4 pt-2 pb-10 sm:pt-4'>
      <main className='flex w-full max-w-md flex-col gap-4'>
        <div className='flex'>
          <GoBack route='/' aria-label='Volver al inicio' className='px-2' />
        </div>
        <section className='flex flex-col gap-5 rounded-3xl border-2 border-stroke p-5 sm:p-6'>
          <div className='flex flex-col items-center gap-3 text-center'>
            <span className='flex size-12 items-center justify-center rounded-full bg-accent-ultra-light'>
              <Ticket className='size-6 text-accent' />
            </span>
            <div className='space-y-1'>
              <h1 className='text-xl font-semibold text-black'>{title}</h1>
              <p className='text-sm text-muted-foreground'>{description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='dni'>DNI del titular</Label>
              <Input
                id='dni'
                name='dni'
                inputMode='numeric'
                autoComplete='off'
                autoFocus
                placeholder='Ej: 38092954'
                value={dni}
                maxLength={30}
                onChange={(e) => {
                  setDni(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'dni-error' : undefined}
              />
              {error && (
                <p id='dni-error' role='alert' className='text-sm text-red-500'>
                  {error}
                </p>
              )}
            </div>
            <Button
              type='submit'
              variant='accent'
              disabled={!dni.trim() || isPending}
              className='h-10 w-full'
            >
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isPending ? 'Verificando...' : 'Ver mi ticket'}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}

/** `/tickets/[id]` abierto desde un navegador que no hizo la compra. */
export function TicketAccessVerify({
  ticketGroupId,
}: {
  ticketGroupId: string;
}) {
  return (
    <TicketHolderVerify
      title='Ingresá tu DNI para ver el ticket'
      description='Por seguridad, para ver el ticket ingresá el DNI de alguna de las personas titulares.'
      verify={(dni) => verifyTicketHolder(ticketGroupId, dni)}
    />
  );
}
