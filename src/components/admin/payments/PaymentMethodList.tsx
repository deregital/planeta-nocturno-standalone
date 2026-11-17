'use client';

import type { ReactNode } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  PAYMENT_BRANDS,
  PaymentMethodIcon,
} from '@/components/payments/payment-brand';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type PaymentMethodItem = RouterOutputs['payments']['methods'][number];
type Method = PaymentMethodItem['method'];
type Status = PaymentMethodItem['status'];

const STATUS: Record<Status, { label: string; className: string }> = {
  active: { label: 'Activo', className: 'bg-green-100 text-green-800' },
  paused: { label: 'Pausado', className: 'bg-gray-200 text-gray-700' },
  not_configured: {
    label: 'Sin configurar',
    className: 'bg-amber-100 text-amber-900',
  },
};

const CONFIRMATION: Record<PaymentMethodItem['confirmation'], string> = {
  webhook: 'Se confirma solo cuando se acredita el pago.',
  manual: 'Confirmás vos cada pago desde la página del evento.',
};

/** Qué pasa al desconectar los medios que se desconectan desde acá. */
const DISCONNECT_COPY: Partial<
  Record<Method, { title: string; description: string }>
> = {
  TRANSFER: {
    title: '¿Desconectar la transferencia?',
    description:
      'Se borra el alias y los compradores dejan de ver esta opción. Las compras pendientes de transferencia siguen como están.',
  },
  TALO: {
    title: '¿Desconectar Talo?',
    description:
      'Los compradores dejan de ver la transferencia inmediata. Para volver a usarla tenés que conectar Talo de nuevo.',
  },
};

/** El modal que hay que abrir al volver de conectar (Mercado Pago, Talo). */
function methodFromReturn(params: URLSearchParams): Method | null {
  if (params.get('mp')) return 'MERCADO_PAGO';
  if (params.get('talo')) return 'TALO';
  return null;
}

export function PaymentMethodList({
  initialMethods,
  details,
  disconnect,
}: {
  initialMethods: PaymentMethodItem[];
  /** Lo propio de cada medio para conectarlo (vincular la cuenta, el alias). */
  details: Partial<Record<Method, ReactNode>>;
  /**
   * Botón propio de desconectar, para los medios que lo tienen (Mercado Pago
   * confirma por mail). null: sin permiso para desconectarlo.
   */
  disconnect: Partial<Record<Method, ReactNode | null>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  // El estado vive en la query y no en el render del servidor: otros
  // componentes de la página navegan (filtros en la URL) y pisarían el
  // resultado de un router.refresh.
  const { data: methods } = trpc.payments.methods.useQuery(undefined, {
    initialData: initialMethods,
  });
  // Al volver de conectar, el resultado se ve en el modal de ese medio.
  const [open, setOpen] = useState<Method | null>(() =>
    methodFromReturn(searchParams),
  );
  const [confirming, setConfirming] = useState<Method | null>(null);

  const refresh = async () => {
    await Promise.all([
      utils.payments.methods.invalidate(),
      utils.payments.taloConnection.invalidate(),
      utils.mercadoPago.getTransferAlias.invalidate(),
    ]);
    router.refresh();
  };
  const setEnabled = trpc.payments.setEnabled.useMutation({
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const disconnected = (label: string) => async () => {
    toast.success(`${label} desconectado`);
    setConfirming(null);
    await refresh();
  };
  const onDisconnectError = (error: { message: string }) => {
    setConfirming(null);
    toast.error(error.message);
  };
  const removeTalo = trpc.payments.removeTaloConnection.useMutation({
    onSuccess: disconnected('Talo'),
    onError: onDisconnectError,
  });
  const removeAlias = trpc.mercadoPago.updateTransferAlias.useMutation({
    onSuccess: disconnected('La transferencia quedó'),
    onError: onDisconnectError,
  });
  const removing = removeTalo.isPending || removeAlias.isPending;

  const openItem = methods.find((item) => item.method === open);
  const confirmCopy = confirming ? DISCONNECT_COPY[confirming] : undefined;

  function disconnectButton(item: PaymentMethodItem) {
    if (item.method === 'MERCADO_PAGO') return disconnect.MERCADO_PAGO ?? null;
    return (
      <Button
        type='button'
        variant='destructive'
        className='mt-auto w-full hover:bg-red-600'
        onClick={() => setConfirming(item.method)}
      >
        Desconectar
      </Button>
    );
  }

  return (
    <>
      <ol className='grid grid-cols-1 gap-3 md:grid-cols-3'>
        {methods.map((item) => {
          const status = STATUS[item.status];
          const brand = PAYMENT_BRANDS[item.method];
          const switchId = `payment-method-${item.method}`;
          const connected = item.status !== 'not_configured';
          return (
            <li
              key={item.method}
              id={item.method === 'MERCADO_PAGO' ? 'mercadopago' : undefined}
              className={cn(
                'flex min-w-0 flex-col gap-3 rounded-md border-2 bg-white p-3',
                brand.border,
              )}
            >
              <div className='flex items-center gap-3'>
                <PaymentMethodIcon method={item.method} className='size-8' />
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1'>
                  <h3 className='truncate font-semibold'>{item.label}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      status.className,
                    )}
                  >
                    {status.label}
                  </span>
                </div>
              </div>

              <div className='flex items-center gap-2'>
                <Switch
                  id={switchId}
                  className='h-6 w-10 **:data-[slot=switch-thumb]:size-5'
                  checked={item.status === 'active'}
                  disabled={setEnabled.isPending || !connected}
                  onCheckedChange={(enabled) =>
                    setEnabled.mutate({ method: item.method, enabled })
                  }
                />
                <Label htmlFor={switchId} className='text-sm'>
                  {connected
                    ? 'Ofrecer a los compradores'
                    : 'Conectalo para ofrecerlo'}
                </Label>
              </div>

              {connected ? (
                disconnectButton(item)
              ) : (
                <Button
                  type='button'
                  className={cn('mt-auto w-full', brand.button)}
                  onClick={() => setOpen(item.method)}
                >
                  {item.method === 'TRANSFER' ? 'Configurar' : 'Conectar'}
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      {/* Conectar: lo propio de cada medio. */}
      <Dialog
        open={openItem !== undefined}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
      >
        {openItem && (
          <DialogContent
            className={cn(
              'flex flex-col gap-4 border-2 sm:max-w-lg',
              PAYMENT_BRANDS[openItem.method].border,
            )}
          >
            <DialogHeader>
              <DialogTitle className='flex items-center gap-3'>
                <PaymentMethodIcon
                  method={openItem.method}
                  className='size-8'
                />
                {openItem.label}
              </DialogTitle>
              <DialogDescription>
                {CONFIRMATION[openItem.confirmation]}
              </DialogDescription>
            </DialogHeader>
            {details[openItem.method]}
          </DialogContent>
        )}
      </Dialog>

      {/* Desconectar Talo o la transferencia. */}
      <Dialog
        open={confirmCopy !== undefined}
        onOpenChange={(next) => {
          if (!next && !removing) setConfirming(null);
        }}
      >
        {confirmCopy && (
          <DialogContent className='flex flex-col gap-4 sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>{confirmCopy.title}</DialogTitle>
              <DialogDescription>{confirmCopy.description}</DialogDescription>
            </DialogHeader>
            <DialogFooter className='flex-wrap gap-2'>
              <Button
                type='button'
                variant='ghost'
                disabled={removing}
                onClick={() => setConfirming(null)}
              >
                Cancelar
              </Button>
              <Button
                type='button'
                variant='destructive'
                className='hover:bg-red-600'
                loading={removing}
                onClick={() =>
                  confirming === 'TALO'
                    ? removeTalo.mutate()
                    : removeAlias.mutate({ transferAlias: null })
                }
              >
                Sí, desconectar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
