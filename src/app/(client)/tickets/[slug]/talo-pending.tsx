'use client';

import type { ComponentProps } from 'react';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { startPaymentFor } from '@/app/(client)/tickets/[slug]/actions';
import { OtherPaymentMethods } from '@/app/(client)/tickets/[slug]/other-payment-methods';
import { CopyableValue } from '@/app/(client)/tickets/[slug]/transfer-pending';
import GoBack from '@/components/common/GoBack';
import DotsLoader from '@/components/icons/DotsLoader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';

const POLL_INTERVAL_MS = 4000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Pago por Talo: CVU propio de la compra; la página se actualiza al acreditarse. */
export default function TicketsTaloPending({
  ticketGroupId,
  eventName,
  account,
  otherPaymentMethods = [],
}: {
  ticketGroupId: string;
  eventName: string;
  account: {
    cvu: string;
    alias: string | null;
    amount: number;
    expiresAt: string | null;
  };
  otherPaymentMethods?: ComponentProps<typeof OtherPaymentMethods>['methods'];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [renewError, setRenewError] = useState<string | null>(null);
  const [isRenewing, startRenew] = useTransition();

  const expired =
    account.expiresAt !== null && new Date(account.expiresAt).getTime() <= now;

  const { data } = trpc.ticketGroup.findById.useQuery(ticketGroupId, {
    refetchInterval: expired ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (data && data.status !== 'BOOKED') router.refresh();
  }, [data, router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const renew = () =>
    startRenew(async () => {
      setRenewError(null);
      const result = await startPaymentFor(ticketGroupId, 'TALO');
      if ('error' in result) setRenewError(result.error);
      else router.refresh();
    });

  return (
    <div className='flex h-full flex-col items-center justify-center px-4'>
      {/* En el celular va arriba de la tarjeta: encima, tapaba el título. */}
      <GoBack
        route='/'
        title='Volver al inicio'
        className='mt-4 self-start md:absolute md:top-24 md:left-26 md:mt-0'
      />
      <Card className='m-4 mx-auto w-full max-w-md text-center shadow-lg'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            {expired
              ? 'Los datos para pagar vencieron'
              : 'Transferí para recibir tus entradas'}
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          {expired ? (
            <>
              <p className='text-muted-foreground'>
                Si ya transferiste, en unos minutos te llegan las entradas por
                mail. Si no, generá datos nuevos para pagar.
              </p>
              <Button
                variant='accent'
                className='w-full whitespace-normal'
                loading={isRenewing}
                onClick={renew}
              >
                Generar datos nuevos
              </Button>
              {renewError && (
                <p role='alert' className='text-sm font-medium text-red-500'>
                  {renewError}
                </p>
              )}
            </>
          ) : (
            <>
              <p className='text-muted-foreground'>
                Tu reserva para {eventName} quedó registrada. Transferí el monto
                exacto desde tu banco o billetera.
              </p>
              <CopyableValue label='CVU' value={account.cvu} />
              {account.alias && (
                <CopyableValue label='Alias' value={account.alias} />
              )}
              <CopyableValue
                label='Monto'
                value={formatCurrency(account.amount)}
              />
              <p className='text-sm text-muted-foreground'>
                {account.expiresAt &&
                  `Estos datos sirven hasta las ${formatTime(account.expiresAt)} hs. `}
                No hace falta mandar comprobante: cuando se acredita, las
                entradas aparecen acá y te llegan por mail.
              </p>
              <div className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                <DotsLoader className='h-5 w-5 text-accent' />
                Esperando la transferencia
              </div>
            </>
          )}
          <OtherPaymentMethods
            ticketGroupId={ticketGroupId}
            methods={otherPaymentMethods}
          />
        </CardContent>
      </Card>
    </div>
  );
}
