import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

import { DataTable } from '@/components/common/DataTable';
import { type RouterOutputs } from '@/server/routers/app';

type AttendedEventRaw = NonNullable<
  RouterOutputs['emittedTickets']['getUniqueBuyer']
>['events'];

type AttendedEvent = Omit<AttendedEventRaw[number], 'id'> & { id: string };

const columns: ColumnDef<AttendedEvent>[] = [
  {
    accessorKey: 'eventName',
    header: 'Evento',
    accessorFn: (row) => row.eventName,
  },
  {
    accessorKey: 'eventStartingDate',
    header: 'Fecha',
    accessorFn: (row) => row.eventStartingDate,
    cell: (info) => format(new Date(info.getValue() as string), 'dd/MM/yyyy'),
  },
  {
    accessorKey: 'locationName',
    header: 'Ubicación',
    accessorFn: (row) => row.locationName,
  },
];

export default function AttendedEventsTable({
  events,
}: {
  events: AttendedEventRaw;
}) {
  const mappedEvents: AttendedEvent[] = events
    .filter((e) => e.id !== null)
    .map((e) => ({ ...e, id: e.id as string }));

  return <DataTable columns={columns} data={mappedEvents} />;
}
