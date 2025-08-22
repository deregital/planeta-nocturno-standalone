import { type Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface PaginationProps<TData> {
  table: Table<TData>;
}

export function Pagination<TData>({ table }: PaginationProps<TData>) {
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    const pageIndex = table.getState().pagination.pageIndex + 1;
    const pageCount = table.getPageCount();

    if (pageIndex > pageCount) {
      table.setPageIndex(pageCount - 1);
    }

    const pageSize = table.getState().pagination.pageSize;
    const params = new URLSearchParams(window.location.search);

    if (firstRender) {
      setFirstRender(false);

      if (params.has('page')) {
        const page = Number(params.get('page'));
        if (page !== pageIndex) {
          table.setPageIndex(page - 1);
        }
      }

      if (params.has('pageSize')) {
        const size = Number(params.get('pageSize'));
        if (size !== pageSize) {
          table.setPageSize(size);
        }
      }
      return;
    }

    params.set('page', pageIndex.toString());
    params.set('pageSize', pageSize.toString());

    window.history.pushState(
      {
        page: pageIndex,
        pageSize: pageSize,
      },
      '',
      `?${params.toString()}`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    firstRender,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().pagination.pageIndex,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getState().pagination.pageSize,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    table.getPageCount(),
  ]);

  const noData = table.getPageCount() === 0;

  return (
    <>
      <div className='border-t border-black/10 bg-transparent px-3 py-3 text-black sm:px-6'>
        <div className='flex items-center justify-between'>
          <div
            id='buttons-pagination'
            className='flex items-center justify-center gap-x-2 px-2'
          >
            <Button
              className='w-8 rounded-md border p-0 text-center disabled:cursor-not-allowed'
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className='w-6' />
            </Button>
            <Button
              className='w-8 rounded-md border p-0 text-center disabled:cursor-not-allowed'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className='w-6' />
            </Button>
            <span className='flex items-center gap-1'>
              <div className='hidden sm:block'>Página</div>
              <strong className='text-sm sm:text-base'>
                {noData
                  ? '0 de 0'
                  : `${table.getState().pagination.pageIndex + 1} de ${table
                      .getPageCount()
                      .toLocaleString()}`}
              </strong>
            </span>
            <Button
              className='w-8 rounded-md border px-0 text-center disabled:cursor-not-allowed'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className='w-6' />
            </Button>
            <Button
              className='w-8 rounded-md border px-0 text-center disabled:cursor-not-allowed'
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className='w-6' />
            </Button>
          </div>
          <span className='hidden items-center gap-1 lg:flex'>
            Ir a la página:
            <input
              type='number'
              min={1}
              max={table.getPageCount()}
              defaultValue={table.getState().pagination.pageIndex + 1}
              onChange={(e) => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                table.setPageIndex(page);
              }}
              className='w-14 rounded-md border text-center text-black'
            />
          </span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              table.setPageSize(size);
            }}
            className='rounded border bg-white/90 p-1 text-sm sm:text-base'
          >
            {[2, 5, 10, 15, 20].map((pageSize) => (
              <option
                className='text-sm sm:text-base'
                key={pageSize}
                value={pageSize}
              >
                Mostrar {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
