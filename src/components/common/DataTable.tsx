'use client';
import * as React from 'react';
import {
  type ColumnDef,
  type SortingState,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  getPaginationRowModel,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Loader } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/event/individual/ticketsTable/Pagination';

interface DataTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  onClickRow?: (id: string) => void;
  initialSortingColumn?: { id: keyof TData; desc: boolean };
}

export function DataTable<TData extends { id: string }, TValue>({
  columns,
  data,
  isLoading,
  onClickRow,
  initialSortingColumn,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(
    initialSortingColumn
      ? [
          {
            id: initialSortingColumn.id as string,
            desc: initialSortingColumn.desc,
          },
        ]
      : [],
  );

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data,
    columns,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      pagination,
    },
    defaultColumn: {
      maxSize: 150, //starting column size
      enableResizing: false,
    },
  });

  return (
    <div className='rounded-md border-stroke/70 border overflow-x-auto w-full md:max-w-[98%] max-w-[95%] mx-auto'>
      <Table className='bg-white'>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    className='text-accent font-bold'
                    style={{
                      width: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className='[&_tr:last-child]:border-0'>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className='py-3'>
                <div className='mx-auto w-fit'>
                  <Loader className='size-4 animate-spin' />
                </div>
              </td>
            </tr>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, idx) => (
              <TableRow
                onClick={() => onClickRow && onClickRow(row.original.id)}
                className={cn(
                  onClickRow && 'cursor-pointer',
                  idx % 2 === 0
                    ? 'bg-accent-ultra-light hover:bg-accent-ultra-light/50'
                    : 'hover:bg-accent-ultra-light/50',
                )}
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className='h-24 text-center'>
                No se encontraron resultados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination table={table} />
    </div>
  );
}
