import { type StrictColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

import { DataTable } from '@/components/common/DataTable';
import { type RouterOutputs } from '@/server/routers/app';

type AttendedEventRaw = NonNullable<
  RouterOutputs['emittedTickets']['getUniqueBuyer']
>['events'];

type AttendedEvent = Omit<AttendedEventRaw[number], 'id'> & { id: string };

const columns: StrictColumnDef<AttendedEvent>[] = [
  {
    accessorKey: 'eventName',
    header: 'Evento',
    accessorFn: (row) => row.eventName,
    meta: {
      exportValue: (row) => row.original.eventName || '-',
      exportHeader: 'Evento',
    },
  },
  {
    accessorKey: 'eventStartingDate',
    header: 'Fecha',
    accessorFn: (row) => row.eventStartingDate,
    cell: (info) => format(new Date(info.getValue() as string), 'dd/MM/yyyy'),
    meta: {
      exportValue: (row) => row.original.eventStartingDate || '-',
      exportHeader: 'Fecha',
    },
  },
  {
    accessorKey: 'locationName',
    header: 'Ubicación',
    accessorFn: (row) => row.locationName,
    meta: {
      exportValue: (row) => row.original.locationName || '-',
      exportHeader: 'Ubicación',
    },
  },
];

export default function AttendedEventsTable({
  events,
  buyerName,
}: {
  events: AttendedEventRaw;
  buyerName: string;
}) {
  const mappedEvents: AttendedEvent[] = events
    .filter((e) => e.id !== null)
    .map((e) => ({ ...e, id: e.id as string }));

  return (
    <DataTable
      fullWidth={false}
      columns={columns}
      data={mappedEvents}
      exportFileName={`Ultimos eventos asistidos de ${buyerName}`}
    />
  );
}
