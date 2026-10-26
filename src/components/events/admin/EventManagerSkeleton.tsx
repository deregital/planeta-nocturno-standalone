import { Skeleton } from '@/components/ui/skeleton';

const EVENT_ROWS = 5;

export default function EventManagerSkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='flex w-full flex-col gap-6 p-4'
    >
      <span className='sr-only'>Cargando eventos</span>
      <Skeleton className='h-9 w-64' />
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex gap-2'>
          <Skeleton className='h-12 w-44' />
          <Skeleton className='h-12 w-36' />
        </div>
        <Skeleton className='h-9 w-full max-w-md' />
      </div>
      <Skeleton className='h-8 w-56' />
      <ul className='flex flex-col gap-4'>
        {Array.from({ length: EVENT_ROWS }, (_, index) => (
          <li
            key={index}
            className='flex h-20 items-center gap-4 rounded-lg border border-stroke/20 px-4 sm:h-14'
          >
            <Skeleton className='h-5 w-2/5 max-w-72' />
            <Skeleton className='hidden h-4 w-48 sm:block' />
            <div className='ml-auto flex shrink-0 gap-1'>
              <Skeleton className='size-8' />
              <Skeleton className='size-8' />
              <Skeleton className='hidden size-8 sm:block' />
            </div>
          </li>
        ))}
      </ul>
      <div className='h-px w-full bg-stroke/15' />
      <Skeleton className='h-8 w-52' />
    </div>
  );
}
