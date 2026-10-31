'use client';

import { type SortingFn, type StrictColumnDef } from '@tanstack/react-table';
import { es } from 'date-fns/locale';
import { Check, ChevronDown, Search, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/components/common/DataTable';
import { SortableColumnHeader } from '@/components/common/table/SortableColumnHeader';
import { useCan } from '@/components/rbac/PermissionsProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatLocalDateTime } from '@/lib/format-date';
import { formatCurrency } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type Purchase = RouterOutputs['ticketGroup']['getPurchasesByEvent'][number];

type TicketTypeItem = {
  amount: number;
  name: string;
};

type PurchaseRow = {
  id: string;
  createdAt: string;
  buyerName: string;
  buyerMail: string;
  ticketTypes: TicketTypeItem[];
  attendees: Purchase['emittedTickets'];
  totalAmount: number;
  paymentMethod: string;
  status: string;
  isPendingTransfer: boolean;
};

type PendingAction = { type: 'release' | 'cancel'; row: PurchaseRow };

const SEARCH_FIELDS = [
  { id: 'createdAt', label: 'Fecha' },
  { id: 'buyer', label: 'Comprador' },
  { id: 'ticketTypes', label: 'Entradas' },
  { id: 'attendees', label: 'Asistentes' },
  { id: 'totalAmount', label: 'Total' },
  { id: 'paymentMethod', label: 'Método' },
  { id: 'status', label: 'Estado' },
] as const;

type SearchFieldId = (typeof SEARCH_FIELDS)[number]['id'];

const STATUS_CLASS: Record<string, string> = {
  Pagado: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Gratis: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  'Pendiente de transferencia': 'border-amber-300 bg-amber-50 text-amber-900',
  'Pago en proceso': 'border-sky-200 bg-sky-50 text-sky-800',
};

const METHOD_CLASS: Record<string, string> = {
  Transferencia: 'border-amber-200 bg-amber-50 text-amber-900',
  'Mercado Pago': 'border-sky-200 bg-sky-50 text-sky-800',
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const textSortingFn: SortingFn<PurchaseRow> = (rowA, rowB, columnId) =>
  String(rowA.getValue(columnId) ?? '').localeCompare(
    String(rowB.getValue(columnId) ?? ''),
    'es',
    { sensitivity: 'base', numeric: true },
  );

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

function formatPurchaseDate(value: string) {
  return formatLocalDateTime(value, 'dd/MM/yyyy HH:mm', { locale: es });
}

function ticketTypesLabel(items: TicketTypeItem[]) {
  if (items.length === 0) return '-';
  return items.map((item) => `${item.amount}x ${item.name}`).join(', ');
}

function attendeesLabel(attendees: Purchase['emittedTickets']) {
  if (attendees.length === 0) return '-';
  return attendees
    .map((ticket) => `${ticket.fullName} (DNI ${ticket.dni})`)
    .join(', ');
}

function toRow(purchase: Purchase, extraTicketData: boolean): PurchaseRow {
  const buyer = purchase.emittedTickets[0];
  return {
    id: purchase.id,
    createdAt: purchase.createdAt,
    buyerName: buyer?.fullName ?? '-',
    buyerMail: buyer?.mail ?? '',
    ticketTypes: purchase.ticketTypePerGroups.map((item) => ({
      amount: item.amount,
      name: item.ticketType.name,
    })),
    attendees: extraTicketData
      ? purchase.emittedTickets
      : purchase.emittedTickets.slice(0, 1),
    totalAmount: Number(purchase.totalAmount),
    paymentMethod: getPaymentMethodLabel(purchase),
    status: getStatusLabel(purchase),
    isPendingTransfer:
      purchase.status === 'BOOKED' && purchase.paymentMethod === 'TRANSFER',
  };
}

function getFieldValues(row: PurchaseRow, field: SearchFieldId): string[] {
  switch (field) {
    case 'createdAt':
      return [formatPurchaseDate(row.createdAt)];
    case 'buyer':
      return [row.buyerName, row.buyerMail].filter(Boolean);
    case 'ticketTypes':
      return row.ticketTypes.flatMap((item) => [
        item.name,
        String(item.amount),
        `${item.amount}x ${item.name}`,
      ]);
    case 'attendees':
      return row.attendees.flatMap((ticket) => [
        ticket.fullName,
        ticket.dni,
        ticket.mail,
      ]);
    case 'totalAmount':
      return [String(row.totalAmount), formatCurrency(row.totalAmount)];
    case 'paymentMethod':
      return [row.paymentMethod];
    case 'status':
      return [row.status];
  }
}

function PurchaseSearch({
  searchTerm,
  onSearchTermChange,
  selectedFields,
  onToggleField,
  onToggleAll,
}: {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  selectedFields: Set<SearchFieldId>;
  onToggleField: (fieldId: SearchFieldId) => void;
  onToggleAll: () => void;
}) {
  const isAllSelected = SEARCH_FIELDS.every((field) =>
    selectedFields.has(field.id),
  );

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mx-auto mb-4'>
      <div className='relative mx-auto flex max-w-md'>
        <Search className='pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-400' />
        <Input
          placeholder='Buscar por comprador, DNI, entradas, método o estado...'
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className='rounded-r-none pl-10'
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Columnas de búsqueda'
              className='h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-stroke bg-white hover:bg-accent/5'
            >
              <ChevronDown className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-52'>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              onClick={onToggleAll}
            >
              <Checkbox
                checked={isAllSelected}
                className='pointer-events-none'
              />
              Todas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {SEARCH_FIELDS.map((field) => (
              <DropdownMenuItem
                key={field.id}
                onSelect={(event) => event.preventDefault()}
                onClick={() => onToggleField(field.id)}
              >
                <Checkbox
                  checked={selectedFields.has(field.id)}
                  className='pointer-events-none'
                />
                {field.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function TicketGroupsTable({
  eventId,
  eventSlug,
  extraTicketData,
}: {
  eventId: string;
  eventSlug: string;
  extraTicketData: boolean;
}) {
  const router = useRouter();
  const canRelease = useCan('tickets:release');
  const utils = trpc.useUtils();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState(
    () => new Set<SearchFieldId>(SEARCH_FIELDS.map((field) => field.id)),
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

  const rows = useMemo(
    () => (purchases ?? []).map((purchase) => toRow(purchase, extraTicketData)),
    [purchases, extraTicketData],
  );

  const filteredRows = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return rows;

    const fields = SEARCH_FIELDS.map((field) => field.id).filter((id) =>
      selectedFields.has(id),
    );

    return rows.filter((row) =>
      fields.some((field) =>
        getFieldValues(row, field).some((value) =>
          normalize(value).includes(term),
        ),
      ),
    );
  }, [rows, searchTerm, selectedFields]);

  const handleToggleAll = () => {
    setSelectedFields(
      selectedFields.size === SEARCH_FIELDS.length
        ? new Set()
        : new Set(SEARCH_FIELDS.map((field) => field.id)),
    );
  };

  const handleToggleField = (fieldId: SearchFieldId) => {
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  const columns = useMemo<StrictColumnDef<PurchaseRow>[]>(
    () => [
      {
        id: 'createdAt',
        accessorFn: (row) => {
          const time = new Date(row.createdAt).getTime();
          return Number.isNaN(time) ? 0 : time;
        },
        sortingFn: 'basic',
        minSize: 148,
        size: 160,
        maxSize: 180,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Fecha' />
        ),
        cell: ({ row }) => (
          <span className='whitespace-nowrap tabular-nums text-sm'>
            {formatPurchaseDate(row.original.createdAt)}
          </span>
        ),
        meta: {
          exportHeader: 'Fecha',
          exportValue: (row) => formatPurchaseDate(row.original.createdAt),
        },
      },
      {
        id: 'buyer',
        accessorFn: (row) => row.buyerName,
        sortingFn: textSortingFn,
        minSize: 180,
        size: 240,
        maxSize: 320,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Comprador' />
        ),
        cell: ({ row }) => (
          <div className='flex min-w-40 flex-col py-0.5'>
            <span className='font-medium leading-snug'>
              {row.original.buyerName}
            </span>
            {row.original.buyerMail ? (
              <span className='text-xs text-muted-foreground'>
                {row.original.buyerMail}
              </span>
            ) : null}
          </div>
        ),
        meta: {
          exportHeader: 'Comprador',
          exportValue: (row) =>
            row.original.buyerMail
              ? `${row.original.buyerName} (${row.original.buyerMail})`
              : row.original.buyerName,
        },
      },
      {
        id: 'ticketTypes',
        accessorFn: (row) => ticketTypesLabel(row.ticketTypes),
        sortingFn: textSortingFn,
        minSize: 140,
        size: 180,
        maxSize: 280,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Entradas' />
        ),
        cell: ({ row }) =>
          row.original.ticketTypes.length === 0 ? (
            '-'
          ) : (
            <div className='flex flex-col gap-1'>
              {row.original.ticketTypes.map((item) => (
                <span
                  key={`${item.name}-${item.amount}`}
                  className='inline-flex w-fit items-center gap-1.5 rounded-md bg-accent-ultra-light px-2 py-0.5 text-xs'
                >
                  <span className='font-semibold tabular-nums'>
                    {item.amount}×
                  </span>
                  {item.name}
                </span>
              ))}
            </div>
          ),
        meta: {
          exportHeader: 'Entradas',
          exportValue: (row) => ticketTypesLabel(row.original.ticketTypes),
        },
      },
      {
        id: 'attendees',
        accessorFn: (row) =>
          row.attendees.map((ticket) => ticket.fullName).join(', ') || '-',
        sortingFn: textSortingFn,
        minSize: 160,
        size: 220,
        maxSize: 320,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Asistentes' />
        ),
        cell: ({ row }) =>
          row.original.attendees.length === 0 ? (
            '-'
          ) : (
            <ul className='flex flex-col gap-1'>
              {row.original.attendees.map((ticket) => (
                <li key={ticket.id} className='leading-snug'>
                  <span>{ticket.fullName}</span>
                  <span className='block text-xs text-muted-foreground'>
                    DNI {ticket.dni}
                  </span>
                </li>
              ))}
            </ul>
          ),
        meta: {
          exportHeader: 'Asistentes',
          exportValue: (row) => attendeesLabel(row.original.attendees),
        },
      },
      {
        id: 'totalAmount',
        accessorKey: 'totalAmount',
        sortingFn: 'basic',
        minSize: 110,
        size: 120,
        maxSize: 150,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Total' />
        ),
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>
            {formatCurrency(row.original.totalAmount)}
          </span>
        ),
        meta: {
          exportHeader: 'Total',
          exportValue: (row) => formatCurrency(row.original.totalAmount),
        },
      },
      {
        id: 'paymentMethod',
        accessorKey: 'paymentMethod',
        sortingFn: textSortingFn,
        minSize: 130,
        size: 150,
        maxSize: 180,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Método' />
        ),
        cell: ({ row }) => (
          <Badge
            variant='outline'
            className={METHOD_CLASS[row.original.paymentMethod]}
          >
            {row.original.paymentMethod}
          </Badge>
        ),
        meta: {
          exportHeader: 'Método',
          exportValue: (row) => row.original.paymentMethod,
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        sortingFn: textSortingFn,
        minSize: 180,
        size: 220,
        maxSize: 260,
        header: ({ column }) => (
          <SortableColumnHeader column={column} label='Estado' />
        ),
        cell: ({ row }) => (
          <Badge
            variant='outline'
            className={STATUS_CLASS[row.original.status]}
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
              enableSorting: false,
              minSize: 140,
              size: 160,
              maxSize: 180,
              header: () => <div className='font-bold'>Acciones</div>,
              cell: ({ row }) =>
                row.original.isPendingTransfer ? (
                  <div className='flex items-center gap-1'>
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
                      size='icon'
                      variant='destructiveGhost'
                      disabled={isMutating}
                      aria-label='Cancelar compra'
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
  const buyerLabel = pendingAction
    ? pendingAction.row.buyerMail
      ? `${pendingAction.row.buyerName} (${pendingAction.row.buyerMail})`
      : pendingAction.row.buyerName
    : '';

  return (
    <div id='purchases'>
      <div className='w-full px-4'>
        <h2 className='text-3xl font-bold text-accent my-4'>Compras</h2>
      </div>
      <PurchaseSearch
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        selectedFields={selectedFields}
        onToggleField={handleToggleField}
        onToggleAll={handleToggleAll}
      />
      {searchTerm.trim() ? (
        <p className='mb-3 text-center text-sm text-muted-foreground'>
          {filteredRows.length} de {rows.length} compras
        </p>
      ) : null}
      <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mb-8 overflow-x-hidden'>
        <DataTable
          columns={columns}
          data={filteredRows}
          isLoading={isLoading}
          initialSortingColumn={{ id: 'createdAt', desc: true }}
          exportFileName={`Compras-${eventSlug}`}
          exportExcludeColumnIds={['actions']}
          noResultsPlaceholder={
            searchTerm.trim()
              ? 'Ninguna compra coincide con la búsqueda.'
              : 'Todavía no hay compras para este evento.'
          }
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
                ? `Confirmá que recibiste la transferencia de ${pendingAction ? formatCurrency(pendingAction.row.totalAmount) : ''}. Las entradas se van a enviar por mail a ${buyerLabel}.`
                : `La reserva de ${buyerLabel} se va a eliminar y las entradas vuelven a estar disponibles para la venta.`}
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
              loading={isMutating}
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
