'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { CircleCheck, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SCAN_TIMEZONE } from '@/lib/scan/scan-texts';
import { formatCurrency } from '@/lib/utils';
import { withdrawalPaymentMethodLabel } from '@/lib/withdrawal';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type Withdrawal = RouterOutputs['withdrawal']['list'][number];
type Status = 'PENDING_REFUND' | 'REFUNDED';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return formatInTimeZone(new Date(value), SCAN_TIMEZONE, 'dd/MM/yyyy HH:mm');
}

/** CBU, CVU o alias que cargó el comprador, con un botón para copiarlo. */
function RefundAccount({ value }: { value: string }) {
  return (
    <div className='flex items-center justify-between gap-2 rounded-md border border-stroke px-3 py-2'>
      <div className='min-w-0'>
        <p className='text-xs text-muted-foreground'>Transferir a</p>
        <p className='font-semibold break-words tabular-nums'>{value}</p>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        aria-label='Copiar CBU, CVU o alias'
        onClick={() => {
          navigator.clipboard
            .writeText(value)
            .then(() => toast.success('Copiado'))
            .catch(() => toast.error('No se pudo copiar'));
        }}
      >
        <Copy className='size-4' />
      </Button>
    </div>
  );
}

function WithdrawalCard({
  withdrawal,
  onRefund,
}: {
  withdrawal: Withdrawal;
  onRefund?: () => void;
}) {
  return (
    <li className='flex flex-col gap-3 rounded-lg border border-stroke p-4'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
        <p className='text-lg font-bold tabular-nums'>{withdrawal.number}</p>
        <p className='text-sm text-muted-foreground'>
          Pedido el {formatDateTime(withdrawal.requestedAt)}
        </p>
      </div>
      <div className='min-w-0'>
        <p className='font-semibold break-words'>{withdrawal.eventName}</p>
        <p className='text-sm break-words'>
          {withdrawal.fullName} · DNI {withdrawal.dni}
        </p>
        <p className='text-sm break-words'>{withdrawal.mail}</p>
      </div>
      <RefundAccount value={withdrawal.refundAccount} />
      <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3'>
        <div className='min-w-0'>
          <dt className='text-xs text-muted-foreground'>A devolver</dt>
          <dd className='font-semibold tabular-nums'>
            {formatCurrency(withdrawal.amount)}
          </dd>
          {withdrawal.serviceFeeAmount > 0 && (
            <dd className='text-xs text-muted-foreground'>
              Incluye {formatCurrency(withdrawal.serviceFeeAmount)} de cargo
            </dd>
          )}
        </div>
        <div className='min-w-0'>
          <dt className='text-xs text-muted-foreground'>Pagó con</dt>
          <dd>{withdrawalPaymentMethodLabel(withdrawal.paymentMethod)}</dd>
        </div>
        <div className='min-w-0'>
          <dt className='text-xs text-muted-foreground'>Entradas anuladas</dt>
          <dd className='tabular-nums'>{withdrawal.ticketCount}</dd>
        </div>
      </dl>
      {withdrawal.status === 'REFUNDED' ? (
        <p className='flex items-center gap-1.5 text-sm text-green-700'>
          <CircleCheck className='size-4 shrink-0' aria-hidden />
          <span>
            Reintegrado el {formatDateTime(withdrawal.refundedAt)}
            {withdrawal.refundedByName
              ? ` por ${withdrawal.refundedByName}`
              : ''}
          </span>
        </p>
      ) : (
        <Button variant='outline' className='self-start' onClick={onRefund}>
          Marcar como reintegrado
        </Button>
      )}
    </li>
  );
}

function WithdrawalList({
  status,
  onRefund,
}: {
  status: Status;
  onRefund: (withdrawal: Withdrawal) => void;
}) {
  const { data, isLoading } = trpc.withdrawal.list.useQuery(status);

  if (isLoading) {
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    );
  }
  if (!data?.length) {
    return (
      <p className='py-8 text-center text-muted-foreground'>
        {status === 'PENDING_REFUND'
          ? 'No hay arrepentimientos por reintegrar.'
          : 'Todavía no hay arrepentimientos reintegrados.'}
      </p>
    );
  }
  return (
    <ul className='flex flex-col gap-3'>
      {data.map((withdrawal) => (
        <WithdrawalCard
          key={withdrawal.id}
          withdrawal={withdrawal}
          onRefund={() => onRefund(withdrawal)}
        />
      ))}
    </ul>
  );
}

export function WithdrawalsClient() {
  const [tab, setTab] = useState<Status>('PENDING_REFUND');
  const [refunding, setRefunding] = useState<Withdrawal | null>(null);
  const utils = trpc.useUtils();
  const { data: pendingCount } = trpc.withdrawal.pendingCount.useQuery();
  const markRefunded = trpc.withdrawal.markRefunded.useMutation({
    onSuccess: ({ number }) => {
      toast.success(`${number} marcado como reintegrado`);
      setRefunding(null);
      utils.withdrawal.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      utils.withdrawal.invalidate();
    },
  });

  return (
    <div className='flex max-w-3xl flex-col gap-4 p-4'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-4xl font-bold text-accent'>Arrepentimientos</h1>
        <p className='text-sm text-muted-foreground'>
          Compras que el comprador revocó con el botón de arrepentimiento. Las
          entradas ya están anuladas: transferí el total a la cuenta que cargó
          el comprador y marcalo acá.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Status)}>
        <TabsList>
          <TabsTrigger value='PENDING_REFUND'>
            Por reintegrar
            {!!pendingCount && (
              <span className='rounded-full bg-accent px-1.5 text-xs text-on-accent tabular-nums'>
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value='REFUNDED'>Reintegrados</TabsTrigger>
        </TabsList>
        <TabsContent value='PENDING_REFUND'>
          <WithdrawalList status='PENDING_REFUND' onRefund={setRefunding} />
        </TabsContent>
        <TabsContent value='REFUNDED'>
          <WithdrawalList status='REFUNDED' onRefund={setRefunding} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!refunding}
        onOpenChange={(open) => {
          if (!open && !markRefunded.isPending) setRefunding(null);
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Marcar como reintegrado</DialogTitle>
            <DialogDescription className='break-words'>
              {refunding && (
                <>
                  ¿Ya le transferiste{' '}
                  <strong>{formatCurrency(refunding.amount)}</strong> a{' '}
                  {refunding.fullName} (
                  <span className='break-words'>{refunding.refundAccount}</span>
                  )? El trámite {refunding.number} pasa a Reintegrados.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='flex-wrap gap-2'>
            <DialogClose asChild>
              <Button type='button' variant='ghost'>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant='accent'
              loading={markRefunded.isPending}
              onClick={() => refunding && markRefunded.mutate(refunding.id)}
            >
              Marcar como reintegrado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
