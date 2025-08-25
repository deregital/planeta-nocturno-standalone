'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type EmittedBuyerTable } from '@/server/schemas/emitted-tickets';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export const emittedBuyerColumns: ColumnDef<EmittedBuyerTable>[] = [
  {
    accessorKey: 'dni',
    header: 'DNI',
  },
  {
    accessorKey: 'fullName',
    header: 'Nombre',
  },
  {
    accessorKey: 'mail',
    header: ({ column }) => (
      <Button
        variant={'ghost'}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className='text-md sm:text-lg md:text-xl font-medium'
      >
        Mail
        <ArrowUpDown />
      </Button>
    ),
  },
  {
    accessorKey: 'age',
    header: 'Edad',
  },
  {
    accessorKey: 'gender',
    header: 'Genero',
  },
  {
    accessorKey: 'phoneNumber',
    header: 'Teléfono',
  },
  {
    accessorKey: 'instagram',
    header: 'Instagram',
  },
];

interface TicketsTableProps<EmittedBuyerTable, TValue> {
  columns: ColumnDef<EmittedBuyerTable, TValue>[];
  data: EmittedBuyerTable[];
}

export function DatabaseTable<EmittedBuyerTable, TValue>({
  columns,
  data,
}: TicketsTableProps<EmittedBuyerTable, TValue>) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState('');

  // Custom filter function that normalizes text
  const customFilterFn = (
    row: Row<EmittedBuyerTable>,
    columnId: string,
    filterValue: string,
  ) => {
    const searchValue = filterValue
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Get the cell value and normalize it
    const cellValue = row.getValue(columnId);
    if (cellValue == null) return false;

    const normalizedCellValue = String(cellValue)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return normalizedCellValue.includes(searchValue);
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: customFilterFn,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className='space-y-4'>
      {/* Filter and Actions */}
      <div className='flex items-center justify-between px-4'>
        <div className='flex items-center space-x-2'>
          <Input
            placeholder='Filtrar por nombre, DNI o teléfono...'
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className='min-w-full'
          />
          {/* Results count */}
          <p className='text-sm'>
            {table.getFilteredRowModel().rows.length} de {data.length}{' '}
            resultados
          </p>
          {globalFilter && (
            <Button
              variant={'ghost'}
              onClick={() => setGlobalFilter('')}
              className='px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors'
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className='max-w-screen md:max-w-[calc(100vw-12rem)] overflow-hidden'>
        <Table className='text-md sm:text-lg md:text-xl font-medium'>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className='hover:bg-transparent [&>th]:text-pn-slate [&>th]:font-medium [&>th]:py-4 [&>th]:px-6'
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  onClick={() =>
                    router.push(`/admin/database/${row.getValue('dni')}`)
                  }
                  className='[&>td]:py-6 [&>td]:px-6 hover:cursor-pointer hover:bg-pn-slate/15 [&>td]:truncate [&>td]:max-w-48'
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  {globalFilter
                    ? 'No se encontraron resultados para la búsqueda.'
                    : 'No hay resultados.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginatión */}
      <div className='flex items-center flex-col sm:flex-row gap-4 justify-between space-x-2 px-4'>
        <div className='flex items-center space-x-2'>
          <Button
            size='sm'
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft />
          </Button>
          <Button
            size='sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <span className='text-sm'>
            Página{' '}
            <span className='font-bold'>
              {table.getState().pagination.pageIndex + 1} de{' '}
              {table.getPageCount()}
            </span>
          </span>
          <Button
            size='sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
          <Button
            size='sm'
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight />
          </Button>
        </div>

        {/* Rows per page selector */}
        <div className='flex items-center space-x-2'>
          <span className='text-sm'>Filas por página:</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder='10' />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 20, 40].map((pageSize) => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
