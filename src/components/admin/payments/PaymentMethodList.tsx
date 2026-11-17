'use client';

import type { ReactNode } from 'react';

import { ArrowDown, ArrowUp, Landmark, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { MercadoPago } from '@/components/icons/MercadoPago';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type PaymentMethodItem = RouterOutputs['payments']['methods'][number];
type Method = PaymentMethodItem['method'];
type Status = PaymentMethodItem['status'];

const ICONS: Record<Method, ReactNode> = {
  MERCADO_PAGO: <MercadoPago />,
  TRANSFER: <Landmark className='size-6 text-accent' aria-hidden />,
  TALO: <Zap className='size-6 text-accent' aria-hidden />,
};

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

export function PaymentMethodList({
  initialMethods,
  details,
}: {
  initialMethods: PaymentMethodItem[];
  /** Lo propio de cada medio (vincular la cuenta, cargar el alias). */
  details: Partial<Record<Method, ReactNode>>;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  // El estado vive en la query y no en el render del servidor: otros
  // componentes de la página navegan (filtros en la URL) y pisarían el
  // resultado de un router.refresh.
  const { data: methods } = trpc.payments.methods.useQuery(undefined, {
    initialData: initialMethods,
  });
  const onSuccess = async () => {
    await utils.payments.methods.invalidate();
    router.refresh();
  };
  const setEnabled = trpc.payments.setEnabled.useMutation({
    onSuccess,
    onError: (error) => toast.error(error.message),
  });
  const setOrder = trpc.payments.setOrder.useMutation({
    onSuccess,
    onError: (error) => toast.error(error.message),
  });
  const busy = setEnabled.isPending || setOrder.isPending;

  function move(index: number, offset: -1 | 1) {
    const order = methods.map((item) => item.method);
    const [moved] = order.splice(index, 1);
    order.splice(index + offset, 0, moved);
    setOrder.mutate({ methods: order });
  }

  return (
    <ol className='flex flex-col gap-3'>
      {methods.map((item, index) => {
        const status = STATUS[item.status];
        const switchId = `payment-method-${item.method}`;
        return (
          <li
            key={item.method}
            id={item.method === 'MERCADO_PAGO' ? 'mercadopago' : undefined}
            className='flex min-w-0 flex-col gap-3 rounded-md border border-stroke bg-accent-ultra-light p-4'
          >
            <div className='flex items-start gap-3'>
              <div className='mt-0.5 shrink-0'>{ICONS[item.method]}</div>
              <div className='flex min-w-0 flex-1 flex-col gap-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h3 className='text-lg font-semibold'>{item.label}</h3>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      status.className,
                    )}
                  >
                    {status.label}
                  </span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  {CONFIRMATION[item.confirmation]}
                </p>
              </div>
              <div className='flex shrink-0 flex-col'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={`Subir ${item.label}`}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className='size-4' />
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={`Bajar ${item.label}`}
                  disabled={busy || index === methods.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className='size-4' />
                </Button>
              </div>
            </div>

            {details[item.method]}

            <div className='flex flex-wrap items-center gap-2 border-t border-stroke pt-3'>
              <Switch
                id={switchId}
                className='h-6 w-10 **:data-[slot=switch-thumb]:size-5'
                checked={item.status === 'active'}
                disabled={busy || item.status === 'not_configured'}
                onCheckedChange={(enabled) =>
                  setEnabled.mutate({ method: item.method, enabled })
                }
              />
              <Label htmlFor={switchId} className='text-sm'>
                {item.status === 'not_configured'
                  ? 'Configuralo para ofrecerlo a los compradores'
                  : 'Ofrecer a los compradores'}
              </Label>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
