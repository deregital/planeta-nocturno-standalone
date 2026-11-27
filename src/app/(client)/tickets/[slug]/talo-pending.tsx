'use client';

import type { ComponentProps } from 'react';
import type { Route } from 'next';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { OtherPaymentMethods } from '@/app/(client)/tickets/[slug]/other-payment-methods';
import { CopyableValue } from '@/app/(client)/tickets/[slug]/transfer-pending';
import GoBack from '@/components/common/GoBack';
import DotsLoader from '@/components/icons/DotsLoader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';
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
  eventSlug,
  contactEmail,
  account,
  otherPaymentMethods = [],
}: {
  ticketGroupId: string;
  eventName: string;
  eventSlug?: string;
  contactEmail: string | null;
  account: {
    cvu: string;
    alias: string | null;
    amount: number;
    expiresAt: string | null;
    /** Lo transferido hasta ahora, si no alcanzó el precio. */
    received: number | null;
    expired: boolean;
    /** Talo está devolviendo una transferencia que llegó tarde. */
    refunding: boolean;
  };
  otherPaymentMethods?: ComponentProps<typeof OtherPaymentMethods>['methods'];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  const expired =
    account.expired ||
    (account.expiresAt !== null &&
      new Date(account.expiresAt).getTime() <= now);
  const missing =
    account.received !== null ? account.amount - account.received : null;

  const { data } = trpc.ticketGroup.findById.useQuery(ticketGroupId, {
    refetchInterval: expired ? false : POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (data && data.status !== 'BOOKED') router.refresh();
  }, [data, router]);

  // Cada 30 s: si vence el CVU, o llega lo que faltaba de un pago de menos.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [router]);

  const contact = contactEmail ? (
    <a href={`mailto:${contactEmail}`} className='font-semibold underline'>
      {contactEmail}
    </a>
  ) : (
    'los organizadores'
  );

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
              ? 'Se venció el tiempo para pagar'
              : missing !== null
                ? 'Te falta completar el pago'
                : 'Transferí para recibir tus entradas'}
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          {expired ? (
            <>
              <p className='text-muted-foreground'>
                Tardaste más de una hora en hacer la transferencia y se
                liberaron las entradas.
              </p>
              <p className='text-sm text-muted-foreground'>
                {account.refunding ? (
                  <>
                    Recibimos tu transferencia tarde: le pedimos a Talo que te
                    la devuelva a la cuenta desde la que transferiste. Si tenés
                    dudas, escribí a {contact}.
                  </>
                ) : (
                  <>
                    Si acabás de transferir, escribí a {contact} para la
                    devolución.
                  </>
                )}
              </p>
              {eventSlug && (
                <Link
                  href={`/event/${eventSlug}` as Route}
                  className='text-sm font-medium text-accent underline'
                >
                  Volver a elegir entradas
                </Link>
              )}
            </>
          ) : (
            <>
              {missing !== null && account.received !== null ? (
                <Alert
                  className={cn(
                    'border-amber-300 bg-amber-50 text-left text-amber-950',
                    '[&>svg]:text-amber-600',
                  )}
                >
                  <AlertTriangle />
                  <AlertTitle>Faltan {formatCurrency(missing)}</AlertTitle>
                  <AlertDescription className='text-amber-900/90'>
                    Recibimos {formatCurrency(account.received)}. Transferí lo
                    que falta al mismo CVU para recibir tus entradas.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className='text-muted-foreground'>
                  Tu reserva para {eventName} quedó registrada. Transferí el
                  monto exacto desde tu banco o billetera.
                </p>
              )}
              <CopyableValue label='CVU' value={account.cvu} />
              {account.alias && (
                <CopyableValue label='Alias' value={account.alias} />
              )}
              <CopyableValue
                label={missing !== null ? 'Monto que falta' : 'Monto'}
                value={formatCurrency(missing ?? account.amount)}
              />
              {/* Talo retiene para revisión manual lo que supera el monto en más de un 10%. */}
              <p className='rounded-md bg-amber-50 px-3 py-2 text-left text-sm text-amber-900'>
                Transferí el monto exacto. Si transferís de más, la
                transferencia queda retenida para revisión y tus entradas se
                demoran.
              </p>
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
              {missing === null && (
                <OtherPaymentMethods
                  ticketGroupId={ticketGroupId}
                  methods={otherPaymentMethods}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
