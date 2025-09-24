'use client';

import {
  type StrictColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { subMonths } from 'date-fns';
import { X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ComparativeTableSkeleton } from '@/components/admin/DatabaseSkeleton';
import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type StatRow = {
  label: string;
  [eventId: string]: string | number;
};

export type ComparativeStatWithType = {
  id: string;
  type: 'EVENT' | 'LOCATION';
};

export default function ComparativeTable() {
  const today = useMemo(() => new Date(), []);
  const searchParams = useSearchParams();

  const from = searchParams.get('from')
    ? new Date(searchParams.get('from') as string)
    : subMonths(today, 1);
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to') as string)
    : today;

  const { data: allEvents, isRefetching: isRefetchingEvents } =
    trpc.statistics.getEventsStats.useQuery({
      from,
      to,
    });
  const { data: allLocations, isRefetching: isRefetchingLocations } =
    trpc.statistics.getLocationsStats.useQuery({
      from,
      to,
    });

  const [colsData, setColsData] = useState<ComparativeStatWithType[]>([]);

  // Derive the actual data from current query results and colsData
  // This automatically filters out items that no longer exist
  const selectedData = useMemo(() => {
    if (!allEvents || !allLocations) return [];

    return colsData
      .map((item) => {
        if (item.type === 'EVENT') {
          const event = allEvents.find((e) => e.id === item.id);
          return event ? { ...event, type: 'EVENT' as const } : null;
        } else if (item.type === 'LOCATION') {
          const location = allLocations.find((l) => l.id === item.id);
          return location ? { ...location, type: 'LOCATION' as const } : null;
        }
        return null;
      })
      .filter(
        Boolean,
      ) as (RouterOutputs['statistics']['getEventsStats'][number] & {
      type: 'EVENT' | 'LOCATION';
    })[];
  }, [colsData, allEvents, allLocations]);

  const eventsList = useMemo(() => {
    return allEvents
      ?.filter(
        (e) => !colsData.some((c) => c.id === e.id && c.type === 'EVENT'),
      )
      .map((e) => ({
        ...e,
        type: 'EVENT' as const,
      }));
  }, [allEvents, colsData]);

  const locationsList = useMemo(() => {
    return allLocations
      ?.filter(
        (l) => !colsData.some((c) => c.id === l.id && c.type === 'LOCATION'),
      )
      .map((l) => ({
        ...l,
        type: 'LOCATION' as const,
      }));
  }, [allLocations, colsData]);

  const removeComparative = (comp: ComparativeStatWithType) => {
    setColsData(
      colsData.filter(
        (item) => !(item.id === comp.id && item.type === comp.type),
      ),
    );
  };

  const rows = useMemo<StatRow[]>(() => {
    return [
      {
        label: 'Entradas emitidas',
        ...Object.fromEntries(selectedData.map((c) => [c.id, c.totalEmitted])),
      },
      {
        label: 'Asistencia',
        ...Object.fromEntries(selectedData.map((c) => [c.id, c.attendance])),
      },
      {
        label: 'Dinero recaudado',
        ...Object.fromEntries(
          selectedData.map((c) => [c.id, `$${c.totalRaised}`]),
        ),
      },
    ];
  }, [selectedData]);

  const columns = useMemo<StrictColumnDef<StatRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: () => <span className='font-medium text-2xl'>Información</span>,
        meta: {
          exportValue: (row) => row.original.label,
          exportHeader: 'Información',
        },
      },
      ...selectedData.map((col) => ({
        accessorKey: col.id,
        header: () => (
          <div className='flex items-center gap-2'>
            <span className='font-medium text-2xl'>{col.name}</span>
            <Button
              variant={'ghost'}
              onClick={() => removeComparative({ id: col.id, type: col.type })}
            >
              <X />
            </Button>
          </div>
        ),
        meta: {
          exportValue: null,
          exportHeader: col.name,
        },
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedData],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (
    !allEvents ||
    !allLocations ||
    isRefetchingEvents ||
    isRefetchingLocations
  ) {
    return <ComparativeTableSkeleton />;
  }

  return (
    <>
      <div className='flex gap-4 px-12'>
        <SelectableComboBox
          title='Agregar evento'
          listOf='evento'
          list={eventsList ?? []}
          onSelectAction={(item) => {
            setColsData([...colsData, { id: item.id, type: 'EVENT' }]);
          }}
        />
        <SelectableComboBox
          title='Agregar locación'
          listOf='locación'
          list={locationsList ?? []}
          onSelectAction={(item) => {
            setColsData([...colsData, { id: item.id, type: 'LOCATION' }]);
          }}
        />
      </div>
      <Table className='border rounded-xl'>
        <TableHeader className='border-2 rounded-2xl border-stroke'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className='px-3 py-2 text-left border-2 border-stroke '
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className='px-3 py-2 text-lg'>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
