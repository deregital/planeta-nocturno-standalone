import { type StrictColumnDef } from '@tanstack/react-table';
import { formatInTimeZone } from 'date-fns-tz';

import { DataTable } from '@/components/common/DataTable';
import { Input } from '@/components/ui/input';
import { type RouterOutputs } from '@/server/routers/app';

type EmittedTicketHistory =
  RouterOutputs['emittedTickets']['getEmissionHistoryByDni'][number];

function formatEmissionDate(createdAt: string) {
  return formatInTimeZone(
    new Date(createdAt),
    'America/Argentina/Buenos_Aires',
    'dd/MM/yyyy HH:mm',
  );
}

const columns: StrictColumnDef<EmittedTicketHistory>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Fecha de emisión',
    accessorFn: (row) => row.createdAt,
    cell: ({ row }) => formatEmissionDate(row.original.createdAt),
    meta: {
      exportValue: (row) => formatEmissionDate(row.original.createdAt),
      exportHeader: 'Fecha de emisión',
    },
  },
  {
    accessorKey: 'eventName',
    header: 'Evento',
    accessorFn: (row) => row.eventName,
    meta: {
      exportValue: (row) => row.original.eventName,
      exportHeader: 'Evento',
    },
  },
  {
    accessorKey: 'ticketTypeName',
    header: 'Tipo de ticket',
    accessorFn: (row) => row.ticketTypeName,
    meta: {
      exportValue: (row) => row.original.ticketTypeName,
      exportHeader: 'Tipo de ticket',
    },
  },
  {
    accessorKey: 'scanned',
    header: 'Escaneado',
    accessorFn: (row) => row.scanned,
    cell: ({ row }) => (
      <Input
        type='checkbox'
        checked={row.original.scanned}
        readOnly
        className='size-6'
      />
    ),
    meta: {
      exportValue: (row) => (row.original.scanned ? 'Sí' : 'No'),
      exportHeader: 'Escaneado',
    },
  },
];

export default function EmissionHistoryTable({
  tickets,
  buyerName,
}: {
  tickets: EmittedTicketHistory[];
  buyerName: string;
}) {
  return (
    <DataTable
      fullWidth={false}
      columns={columns}
      data={tickets}
      exportFileName={`Historial de emisiones de ${buyerName}`}
    />
  );
}
