'use client';

import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { Loader, X } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';


type StatRow = {
  label: string;
  [eventId: string]: string | number;
};

export type ComparativeStatWithType =
  RouterOutputs['statistics']['getEventsStats'][number] & {
    type: 'EVENT' | 'LOCATION';
  };

export default function ComparativeTable() {
  const { data: allEvents } = trpc.statistics.getEventsStats.useQuery();
  const { data: allLocations } = trpc.statistics.getLocationsStats.useQuery();

  const [eventsList, setEventsList] = useState<ComparativeStatWithType[]>([]);
  const [locationsList, setLocationsList] = useState<ComparativeStatWithType[]>(
    [],
  );

  const [colsData, setColsData] = useState<ComparativeStatWithType[]>([]);

  useEffect(() => {
    if (allEvents) {
      setEventsList(
        allEvents.map((e) => ({
          ...e,
          type: 'EVENT',
        })),
      );
    }
    if (allLocations) {
      setLocationsList(
        allLocations.map((l) => ({
          ...l,
          type: 'LOCATION',
        })),
      );
    }
  }, [allEvents, allLocations]);

  const removeComparative = (comp: ComparativeStatWithType) => {
    setColsData(colsData.filter((colsData) => colsData.id !== comp.id));
    if (comp.type === 'EVENT') {
      setEventsList([...eventsList, comp]);
    } else if (comp.type === 'LOCATION') {
      setLocationsList([...locationsList, comp]);
    }
  };

  const rows = useMemo<StatRow[]>(() => {
    return [
      {
        label: 'Entradas emitidas',
        ...Object.fromEntries(colsData.map((c) => [c.id, c.totalEmitted])),
      },
      {
        label: 'Asistencia',
        ...Object.fromEntries(colsData.map((c) => [c.id, c.attendance])),
      },
      {
        label: 'Dinero recaudado',
        ...Object.fromEntries(colsData.map((c) => [c.id, `$${c.totalRaised}`])),
      },
    ];
  }, [colsData]);

  const columns = useMemo<ColumnDef<StatRow>[]>(
    () => [
      {
        accessorKey: 'label',
        header: () => <span className='font-medium text-2xl'>Información</span>,
        cell: (info: CellContext<StatRow, unknown>) => (
          <span className='font-medium'>{info.getValue() as string}</span>
        ),
      },
      ...colsData.map((col) => ({
        accessorKey: col.id,
        header: () => (
          <div className='flex items-center gap-2'>
            <span className='font-medium text-2xl'>{col.name}</span>
            <Button variant={'ghost'} onClick={() => removeComparative(col)}>
              <X />
            </Button>
          </div>
        ),
        cell: (info: CellContext<StatRow, unknown>) => info.getValue(),
      })),
    ],
    [colsData, removeComparative],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!allEvents || !allLocations) {
    return <Loader />;
  }

  return (
    <>
      <div className='flex gap-4 px-12'>
        <SelectableComboBox
          title='Agregar evento'
          listOf='evento'
          list={eventsList}
          onSelect={(item) => {
            setColsData([...colsData, { ...item, type: 'EVENT' }]);
            setEventsList(eventsList.filter((e) => e.id !== item.id));
          }}
        />
        <SelectableComboBox
          title='Agregar locación'
          listOf='locación'
          list={locationsList}
          onSelect={(item) => {
            setColsData([...colsData, { ...item, type: 'LOCATION' }]);
            setLocationsList(locationsList.filter((l) => l.id !== item.id));
          }}
        />
      </div>
      <Table className='border rounded-xl'>
        <TableHeader className='border-2 rounded-2xl border-pn-stroke'>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className='px-3 py-2 text-left border-2 border-pn-stroke '
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
