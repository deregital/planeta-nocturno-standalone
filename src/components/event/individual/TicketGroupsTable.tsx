'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { useCan } from '@/components/rbac/PermissionsProvider';
import { Badge } from '@/components/ui/badge';
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
import { cn, formatCurrency } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type Purchase = RouterOutputs['ticketGroup']['getPurchasesByEvent'][number];

type PurchaseRow = {
  id: string;
  createdAt: string;
  buyer: string;
  ticketTypes: string;
  attendees: Purchase['emittedTickets'];
  totalAmount: number;
  paymentMethod: string;
  status: string;
  isPendingTransfer: boolean;
};

type PendingAction = { type: 'release' | 'cancel'; row: PurchaseRow };

function getStatusLabel(purchase: Purchase) {
  if (purchase.status === 'PAID') return 'Pagado';
  if (purchase.status === 'FREE') return 'Gratis';
  if (purchase.paymentMethod === 'TRANSFER')
    return 'Pendiente de transferencia';
  return 'Pago en proceso';
}

function getPaymentMethodLabel(purchase: Purchase) {
  if (purchase.paymentMethod === 'TRANSFER') return 'Transferencia';
  if (purchase.paymentMethod === 'MERCADO_PAGO') return 'Mercado Pago';
  return '-';
}

function toRow(purchase: Purchase): PurchaseRow {
  const buyer = purchase.emittedTickets[0];
  return {
    id: purchase.id,
    createdAt: purchase.createdAt,
    buyer: buyer ? `${buyer.fullName} (${buyer.mail})` : '-',
    ticketTypes: purchase.ticketTypePerGroups
      .map((item) => `${item.amount}x ${item.ticketType.name}`)
      .join(', '),
    attendees: purchase.emittedTickets,
    totalAmount: Number(purchase.totalAmount),
    paymentMethod: getPaymentMethodLabel(purchase),
    status: getStatusLabel(purchase),
    isPendingTransfer:
      purchase.status === 'BOOKED' && purchase.paymentMethod === 'TRANSFER',
  };
}

export function TicketGroupsTable({
  eventId,
  eventSlug,
}: {
  eventId: string;
  eventSlug: string;
}) {
  const router = useRouter();
  const canRelease = useCan('tickets:release');
  const utils = trpc.useUtils();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  const { data: purchases, isLoading } =
    trpc.ticketGroup.getPurchasesByEvent.useQuery(eventId);

  const onSettled = () => {
    setPendingAction(null);
    utils.ticketGroup.getPurchasesByEvent.invalidate(eventId);
    utils.emittedTickets.getByEventId.invalidate();
    router.refresh();
  };

  const releaseTransfer = trpc.ticketGroup.releaseTransfer.useMutation({
    onSuccess: () =>
      toast.success('Entradas liberadas y enviadas al comprador'),
    onError: (error) => toast.error(error.message),
    onSettled,
  });
  const cancelTransfer = trpc.ticketGroup.cancelTransfer.useMutation({
    onSuccess: () => toast.success('Compra cancelada'),
    onError: (error) => toast.error(error.message),
    onSettled,
  });
  const isMutating = releaseTransfer.isPending || cancelTransfer.isPending;

  const rows = useMemo(() => (purchases ?? []).map(toRow), [purchases]);

  const columns = useMemo<StrictColumnDef<PurchaseRow>[]>(
    () => [
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: () => <div>Fecha</div>,
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm', {
            locale: es,
          }),
        meta: {
          exportHeader: 'Fecha',
          exportValue: (row) =>
            format(new Date(row.original.createdAt), 'dd/MM/yyyy HH:mm'),
        },
      },
      {
        id: 'buyer',
        accessorKey: 'buyer',
        header: () => <div>Comprador</div>,
        cell: ({ row }) => row.original.buyer,
        meta: {
          exportHeader: 'Comprador',
          exportValue: (row) => row.original.buyer,
        },
      },
      {
        id: 'ticketTypes',
        accessorKey: 'ticketTypes',
        header: () => <div>Entradas</div>,
        cell: ({ row }) => row.original.ticketTypes,
        meta: {
          exportHeader: 'Entradas',
          exportValue: (row) => row.original.ticketTypes,
        },
      },
      {
        id: 'attendees',
        accessorFn: (row) =>
          row.attendees.map((ticket) => ticket.fullName).join(', '),
        header: () => <div>Asistentes</div>,
        cell: ({ row }) => (
          <ul className='flex flex-col gap-0.5'>
            {row.original.attendees.map((ticket) => (
              <li key={ticket.id} className='whitespace-nowrap'>
                {ticket.fullName}{' '}
                <span className='text-muted-foreground'>
                  - DNI {ticket.dni}
                </span>
              </li>
            ))}
          </ul>
        ),
        meta: {
          exportHeader: 'Asistentes',
          exportValue: (row) =>
            row.original.attendees
              .map((ticket) => `${ticket.fullName} (DNI ${ticket.dni})`)
              .join(', '),
        },
      },
      {
        id: 'totalAmount',
        accessorKey: 'totalAmount',
        header: () => <div>Total</div>,
        cell: ({ row }) => formatCurrency(row.original.totalAmount),
        meta: {
          exportHeader: 'Total',
          exportValue: (row) => formatCurrency(row.original.totalAmount),
        },
      },
      {
        id: 'paymentMethod',
        accessorKey: 'paymentMethod',
        header: () => <div>Método</div>,
        cell: ({ row }) => row.original.paymentMethod,
        meta: {
          exportHeader: 'Método',
          exportValue: (row) => row.original.paymentMethod,
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: () => <div>Estado</div>,
        cell: ({ row }) => (
          <Badge
            variant='outline'
            className={cn(
              row.original.isPendingTransfer &&
                'border-amber-300 bg-amber-50 text-amber-900',
            )}
          >
            {row.original.status}
          </Badge>
        ),
        meta: {
          exportHeader: 'Estado',
          exportValue: (row) => row.original.status,
        },
      },
      ...(canRelease
        ? [
            {
              id: 'actions',
              header: () => <div>Acciones</div>,
              cell: ({ row }) =>
                row.original.isPendingTransfer ? (
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='success'
                      disabled={isMutating}
                      onClick={() =>
                        setPendingAction({ type: 'release', row: row.original })
                      }
                    >
                      <Check className='size-4' />
                      Liberar
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      className='text-red-500'
                      disabled={isMutating}
                      onClick={() =>
                        setPendingAction({ type: 'cancel', row: row.original })
                      }
                    >
                      <Trash className='size-4' />
                    </Button>
                  </div>
                ) : null,
              meta: { exportHeader: null, exportValue: null },
            } satisfies StrictColumnDef<PurchaseRow>,
          ]
        : []),
    ],
    [canRelease, isMutating],
  );

  const isRelease = pendingAction?.type === 'release';

  return (
    <div id='purchases'>
      <div className='w-full px-4'>
        <h2 className='text-3xl font-bold text-accent my-4'>Compras</h2>
      </div>
      <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mb-8 overflow-x-hidden'>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          exportFileName={`Compras-${eventSlug}`}
          exportExcludeColumnIds={['actions']}
          noResultsPlaceholder='Todavía no hay compras para este evento.'
        />
      </div>
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && !isMutating && setPendingAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isRelease ? 'Liberar entradas' : 'Cancelar compra'}
            </DialogTitle>
            <DialogDescription>
              {isRelease
                ? `Confirmá que recibiste la transferencia de ${pendingAction ? formatCurrency(pendingAction.row.totalAmount) : ''}. Las entradas se van a enviar por mail a ${pendingAction?.row.buyer}.`
                : `La reserva de ${pendingAction?.row.buyer} se va a eliminar y las entradas vuelven a estar disponibles para la venta.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='ghost' disabled={isMutating}>
                Volver
              </Button>
            </DialogClose>
            <Button
              variant={isRelease ? 'success' : 'destructive'}
              disabled={isMutating}
              onClick={() => {
                if (!pendingAction) return;
                if (isRelease) releaseTransfer.mutate(pendingAction.row.id);
                else cancelTransfer.mutate(pendingAction.row.id);
              }}
            >
              {isMutating
                ? 'Procesando...'
                : isRelease
                  ? 'Liberar entradas'
                  : 'Cancelar compra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
