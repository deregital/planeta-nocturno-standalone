'use client';

import { Loader2 } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState, useTransition } from 'react';

import { retryMercadoPagoPayment } from '@/app/(client)/tickets/[slug]/actions';
import GoBack from '@/components/common/GoBack';
import DotsLoader from '@/components/icons/DotsLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/server/trpc/client';

const POLL_INTERVAL_MS = 3000;

function deleteCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

function isNotFound(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    (error as { data?: { code?: string } }).data?.code === 'NOT_FOUND'
  );
}

/** collection_status con el que vuelve Mercado Pago; vacío si se volvió con Atrás. */
export type ReturnedPaymentStatus =
  | 'approved'
  | 'pending'
  | 'in_process'
  | 'rejected'
  | 'null'
  | undefined;

export default function TicketsPendingClient({
  ticketGroupId,
  paymentUrl,
  paymentStatus,
  eventSlug,
  holdExpiresAt,
  canRetryPayment,
}: {
  ticketGroupId: string;
  paymentUrl?: string;
  paymentStatus?: ReturnedPaymentStatus;
  eventSlug?: string;
  holdExpiresAt?: string | null;
  canRetryPayment?: boolean;
}) {
  const router = useRouter();
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, startRetry] = useTransition();

  const { data, error } = trpc.ticketGroup.findById.useQuery(ticketGroupId, {
    // Si la reserva ya no existe, dejar de consultar (antes pedía cada 3 s para siempre).
    refetchInterval: (query) =>
      paymentUrl || isNotFound(query.state.error) ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: (failureCount, retryError) =>
      !isNotFound(retryError) && failureCount < 3,
  });

  useEffect(() => {
    if (paymentUrl) {
      deleteCookie('pendingPaymentUrl');
      window.location.href = paymentUrl;
    }
  }, [paymentUrl]);

  useEffect(() => {
    if (data && data.status !== 'BOOKED') {
      router.refresh();
    }
  }, [data, router]);

  if (paymentUrl) {
    return (
      <div className='flex justify-center items-center h-full'>
        <Card className='w-full max-w-md mx-auto text-center shadow-lg m-4'>
          <CardHeader>
            <CardTitle className='text-2xl font-bold'>
              Redirigiendo a pasarela de pago
            </CardTitle>
          </CardHeader>
          <CardContent className='flex flex-col items-center gap-4'>
            <Loader2 className='h-8 w-8 animate-spin text-accent' />
            <p className='text-sm text-muted-foreground'>
              No cierres esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventRoute = (eventSlug ? `/event/${eventSlug}` : '/') as Route;
  const holdUntil = holdExpiresAt
    ? new Date(holdExpiresAt).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    : null;

  const retry = () =>
    startRetry(async () => {
      setRetryError(null);
      const result = await retryMercadoPagoPayment(ticketGroupId);
      if ('url' in result) {
        window.location.href = result.url;
      } else {
        setRetryError(result.error);
      }
    });

  let title: string;
  let body: ReactNode;
  let waiting = true;

  if (isNotFound(error)) {
    waiting = false;
    title = 'Tu reserva venció';
    body = (
      <p className='text-muted-foreground'>
        No recibimos el pago a tiempo y las entradas se liberaron. Si Mercado
        Pago te cobró, escribinos y lo resolvemos.
      </p>
    );
  } else if (paymentStatus === 'approved') {
    title = 'Procesando tu pago...';
    body = (
      <p className='text-muted-foreground'>
        Mercado Pago aprobó el pago. En unos segundos aparecen tus entradas acá
        y te llegan por mail.
      </p>
    );
  } else if (paymentStatus === 'pending' || paymentStatus === 'in_process') {
    title = 'Tu pago está pendiente';
    body = (
      <p className='text-muted-foreground'>
        Mercado Pago todavía no lo acreditó (pago en efectivo o en revisión).
        Cuando se apruebe te mandamos las entradas por mail; no hace falta que
        dejes esta página abierta.
      </p>
    );
  } else {
    waiting = false;
    title =
      paymentStatus === 'rejected'
        ? 'Mercado Pago rechazó el pago'
        : 'Todavía no recibimos tu pago';
    body = (
      <>
        <p className='text-muted-foreground'>
          {holdUntil && canRetryPayment
            ? `Tus entradas siguen reservadas hasta las ${holdUntil} hs.`
            : 'Si ya pagaste, en unos segundos aparecen tus entradas acá.'}
        </p>
        {canRetryPayment && (
          <Button
            variant='accent'
            className='w-full'
            onClick={retry}
            loading={isRetrying}
          >
            Pagar con Mercado Pago
          </Button>
        )}
        {retryError && (
          <p role='alert' className='text-sm font-medium text-red-500'>
            {retryError}
          </p>
        )}
      </>
    );
  }

  return (
    <div className='flex justify-center items-center h-full'>
      <GoBack
        route='/'
        title='Volver al inicio'
        className='absolute top-24 md:left-26 left-4'
      />
      <Card className='w-full max-w-md mx-auto text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>{title}</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col items-center gap-4'>
          {waiting && <DotsLoader className='h-6 w-6 text-accent' />}
          {body}
          {eventSlug && (
            <Link
              href={eventRoute}
              className='text-sm font-medium text-accent underline'
            >
              Volver al evento
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
