'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { type TaloConnectResult } from '@/lib/payments/talo-paths';
import { trpc } from '@/server/trpc/client';

const RESULT_MESSAGES: Record<
  TaloConnectResult,
  { text: string; tone: 'ok' | 'error' }
> = {
  conectado: { text: 'Talo quedó conectado.', tone: 'ok' },
  cancelado: {
    text: 'No se completó la autorización en Talo.',
    tone: 'error',
  },
  vencido: {
    text: 'La conexión venció o la empezó otra persona. Volvé a tocar "Conectar con Talo".',
    tone: 'error',
  },
  rechazado: {
    text: 'Talo no aceptó la autorización (vence a los 5 minutos). Volvé a conectar.',
    tone: 'error',
  },
  error: {
    text: 'No pudimos terminar la conexión con Talo. Probá de nuevo en un momento.',
    tone: 'error',
  },
};

const STATUS_MESSAGES: Record<string, { text: string; tone: 'ok' | 'warn' }> = {
  ACTIVE: { text: 'Cuenta activa: ya se puede cobrar.', tone: 'ok' },
  PENDING: {
    text: 'Talo está verificando la cuenta (puede tardar hasta 36 h). Mientras tanto no se ofrece a los compradores.',
    tone: 'warn',
  },
  REJECTED: {
    text: 'Talo rechazó la verificación de la cuenta. Revisalo desde tu panel de Talo.',
    tone: 'warn',
  },
  SUSPENDED: {
    text: 'Talo suspendió la cuenta. Revisalo desde tu panel de Talo.',
    tone: 'warn',
  },
  INVALID: {
    text: 'La conexión dejó de funcionar. Desconectá y volvé a conectar.',
    tone: 'warn',
  },
  UNKNOWN: {
    text: 'No pudimos consultar el estado de la cuenta en Talo.',
    tone: 'warn',
  },
};

/** "Conectar con Talo", dentro de su tarjeta en Medios de pago. */
export function TaloConnect() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const result = searchParams.get('talo') as TaloConnectResult | null;
  const resultMessage = result ? RESULT_MESSAGES[result] : undefined;

  const { data, isLoading } = trpc.payments.taloConnection.useQuery();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const start = trpc.payments.startTaloConnect.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.payments.removeTaloConnection.useMutation({
    onSuccess: () => {
      toast.success('Talo desconectado');
      setConfirmingRemove(false);
      utils.payments.taloConnection.invalidate();
      utils.payments.methods.invalidate();
    },
    onError: (error) => {
      setConfirmingRemove(false);
      toast.error(error.message);
    },
  });

  if (isLoading || !data) return null;

  if (!data.enabled) {
    return (
      <p className='text-sm text-muted-foreground'>
        Talo todavía no está habilitado en esta plataforma.
      </p>
    );
  }

  const connection = data.connection;
  const status = connection?.status
    ? STATUS_MESSAGES[connection.status]
    : undefined;

  return (
    <div className='flex w-full flex-col items-start gap-3'>
      <p className='text-sm text-muted-foreground'>
        Cada compra recibe un CVU propio y las entradas se mandan solas cuando
        se acredita la transferencia. La plata va directo a tu cuenta de Talo.
        {data.sandbox && (
          <>
            {' '}
            <span className='font-medium text-amber-700'>
              Modo de prueba (sandbox): no se cobra plata real.
            </span>
          </>
        )}
      </p>

      {resultMessage && (
        <p
          role='status'
          className={
            resultMessage.tone === 'ok'
              ? 'text-sm font-medium text-green-700'
              : 'text-sm font-medium text-red-600'
          }
        >
          {resultMessage.text}
        </p>
      )}

      {connection ? (
        <>
          {status && (
            <p
              className={
                status.tone === 'ok'
                  ? 'text-sm font-medium text-green-700'
                  : 'text-sm font-medium text-amber-800'
              }
            >
              {status.text}
            </p>
          )}
          <p className='text-xs break-all text-muted-foreground'>
            Cuenta de Talo: {connection.userId}
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            {confirmingRemove ? (
              <>
                <Button
                  type='button'
                  variant='destructive'
                  className='w-fit'
                  loading={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Sí, desconectar
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  className='w-fit'
                  disabled={remove.isPending}
                  onClick={() => setConfirmingRemove(false)}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                type='button'
                variant='destructiveGhost'
                className='w-fit'
                onClick={() => setConfirmingRemove(true)}
              >
                Desconectar
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className='text-sm text-muted-foreground'>
            Te llevamos a Talo para que entres (o crees tu cuenta) y autorices
            la conexión.
          </p>
          <Button
            type='button'
            className='w-fit'
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            Conectar con Talo
          </Button>
        </>
      )}
    </div>
  );
}
