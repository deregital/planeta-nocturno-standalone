'use client';
import {
  type PaginationState,
  type SortingState,
  type StrictColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Download, Loader } from 'lucide-react';
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { validatePassword } from '@/app/actions/DataTable';
import { Pagination } from '@/components/event/individual/ticketsTable/Pagination';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { exportTableToXlsx } from '@/lib/utils-client';

interface DataTableProps<TData extends { id: string }, TValue> {
  fullWidth?: boolean;
  columns: StrictColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  onClickRow?: (id: string) => void;
  initialSortingColumn?: { id: keyof TData; desc: boolean };
  highlightedRowId?: string | null;
  exportFileName?: string;
  exportExcludeColumnIds?: string[]; // Ver type safety
  disableExport?: boolean;
}

export function DataTable<TData extends { id: string }, TValue>({
  fullWidth = true,
  columns,
  data,
  isLoading,
  onClickRow,
  initialSortingColumn,
  highlightedRowId,
  exportFileName = 'tabla',
  exportExcludeColumnIds = [],
  disableExport = false,
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

  const targetPageIndex = useMemo(() => {
    if (highlightedRowId && data.length > 0) {
      const highlightedIndex = data.findIndex(
        (item) => item.id === highlightedRowId,
      );
      if (highlightedIndex !== -1) {
        return Math.floor(highlightedIndex / pagination.pageSize);
      }
    }
    return pagination.pageIndex;
  }, [highlightedRowId, data, pagination.pageSize, pagination.pageIndex]);

  const effectivePagination = useMemo(
    () => ({
      ...pagination,
      pageIndex: targetPageIndex,
    }),
    [pagination, targetPageIndex],
  );

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
      pagination: effectivePagination,
    },
    defaultColumn: {
      maxSize: 150, //starting column size
      enableResizing: false,
    },
  });

  const [state, action, isPending] = useActionState(validatePassword, {
    ok: false,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      handleExportXlsx();
      setIsDialogOpen(false);
      startTransition(() => {
        action(new FormData());
      });
    }
  }, [state.ok, action]);

  const handleExportXlsx = useCallback(() => {
    const headerGroup = table.getHeaderGroups()[0];
    const headers = headerGroup.headers
      .filter((h) => !exportExcludeColumnIds.includes(h.column.id as string))
      .map((h) => {
        const meta = h.column.columnDef.meta?.exportHeader;

        if (meta) {
          return meta;
        }

        return h.id;
      });

    const rows = table.getCoreRowModel().rows.map((row) =>
      row
        .getVisibleCells()
        .filter(
          (cell) => !exportExcludeColumnIds.includes(cell.column.id as string),
        )
        .map((cell) => {
          const meta = cell.column.columnDef.meta?.exportValue;

          if (meta) {
            return meta(row);
          }

          return row.getValue(cell.column.id) as string;
        }),
    );

    const flatRows = rows.map((cells) => cells.map((value) => value));

    exportTableToXlsx(headers, flatRows, exportFileName);
  }, [table, exportExcludeColumnIds, exportFileName]);

  return (
    <div className='rounded-md border-stroke/70 border overflow-x-clip w-full max-w-[98%] mx-auto'>
      {!disableExport && (
        <div className='flex justify-end p-2'>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm'>
                <Download className='size-4 mr-2' /> Exportar a Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form action={action}>
                <DialogHeader>
                  <DialogTitle>Introducí tu contraseña</DialogTitle>
                  <DialogDescription>
                    Para exportar la tabla, introducí la contraseña de tu
                    cuenta.
                  </DialogDescription>
                </DialogHeader>
                <div className='mt-2 mb-4'>
                  <Input
                    type='password'
                    id='password'
                    name='password'
                    placeholder='******'
                  />
                  {state.error && (
                    <p className='text-sm pl-1 font-bold text-red-500'>
                      {state.error}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button size='sm' type='submit' disabled={isPending}>
                    Verificar y exportar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <Table className='bg-white' fullWidth={fullWidth}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow className='hover:bg-inherit' key={headerGroup.id}>
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
                  {
                    'border-stroke! border-dashed! border-2! bg-accent-light/50!':
                      highlightedRowId === row.original.id,
                  },
                  idx % 2 === 0
                    ? 'bg-accent-ultra-light hover:bg-gray-500/15'
                    : 'hover:bg-gray-500/15',
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
