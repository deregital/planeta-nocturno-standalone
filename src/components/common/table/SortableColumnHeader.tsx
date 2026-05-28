import { type Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function SortableColumnHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>;
  label: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant='ghost'
      className='h-auto gap-2 px-0 font-bold hover:bg-transparent'
      onClick={() =>
        column.getIsSorted() === 'desc'
          ? column.clearSorting()
          : column.toggleSorting(column.getIsSorted() === 'asc')
      }
    >
      {label}
      {sorted === 'asc' && <ArrowUp className='h-4 w-4' />}
      {sorted === 'desc' && <ArrowDown className='h-4 w-4' />}
      {!sorted && <ArrowUpDown className='h-4 w-4' />}
    </Button>
  );
}
