'use client';

import { type Route } from 'next';
import { Loader2, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import GoBack from '@/components/common/GoBack';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/server/trpc/client';

export default function InvitationTicketVerify({
  eventSlug,
  code,
}: {
  eventSlug: string;
  code: string;
}) {
  const router = useRouter();
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const verify = trpc.ticketGroup.verifyInvitationHolder.useMutation({
    onSuccess: (result) => {
      if (result.status === 'ok') {
        setRedirecting(true);
        router.replace(`/tickets/${result.ticketGroupId}` as Route);
        return;
      }
      setError(
        result.status === 'rate_limited'
          ? 'Hiciste demasiados intentos. Esperá un rato y volvé a intentar.'
          : 'El DNI no coincide con el del titular de esta invitación.',
      );
    },
    onError: () => {
      setError('No pudimos verificar tus datos. Intentá nuevamente.');
    },
  });

  const isLoading = verify.isPending || redirecting;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dni.trim() || isLoading) return;
    setError(null);
    verify.mutate({ eventSlug, code, dni });
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
              <h1 className='text-xl font-semibold text-black'>
                Tu invitación ya tiene un ticket
              </h1>
              <p className='text-sm text-muted-foreground'>
                Para verlo, ingresá el DNI de la persona titular del ticket.
              </p>
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
              disabled={!dni.trim() || isLoading}
              className='h-10 w-full'
            >
              {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isLoading ? 'Verificando...' : 'Ver mi ticket'}
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
