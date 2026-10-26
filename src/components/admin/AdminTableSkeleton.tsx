import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_COLUMNS = 5;
const DEFAULT_ROWS = 8;

export function AdminTableFrame({
  columns = DEFAULT_COLUMNS,
  rows = DEFAULT_ROWS,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className='mx-auto w-full max-w-[98%] overflow-hidden rounded-md border border-stroke/20 bg-white'>
      <div className='flex justify-end p-2'>
        <Skeleton className='h-8 w-40' />
      </div>
      <div className='flex gap-4 border-b border-stroke/15 px-4 py-3'>
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className='h-4 min-w-12 flex-1' />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className='flex gap-4 border-b border-stroke/10 px-4 py-3 last:border-b-0'
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={
                column === 0 ? 'h-4 w-16 shrink-0' : 'h-4 min-w-12 flex-1'
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}
