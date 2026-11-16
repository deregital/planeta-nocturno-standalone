import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function TicketPageSkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='flex justify-center px-4 pt-2 pb-10 sm:pt-4'
    >
      <span className='sr-only'>Cargando tus tickets</span>
      <main className='flex w-full max-w-3xl flex-col gap-4 sm:gap-6'>
        {/* Barra superior */}
        <div className='flex items-center gap-2'>
          <Skeleton className='size-9 shrink-0 rounded-md' />
          <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
            <Skeleton className='h-5 w-28 sm:h-6 sm:w-36' />
            <Skeleton className='h-3 w-40 sm:h-4 sm:w-52' />
          </div>
        </div>

        {/* Ticket */}
        <div className='flex flex-col overflow-hidden rounded-3xl border-2 border-stroke bg-white sm:flex-row'>
          <div className='relative flex flex-col items-center gap-3 bg-accent-ultra-light px-4 pt-4 pb-5 sm:w-80 sm:shrink-0 sm:justify-center sm:py-6'>
            <div className='flex w-full items-center justify-between gap-2'>
              <Skeleton className='h-6 w-24 rounded-full bg-white/70 sm:h-7' />
            </div>
            <div className='rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5'>
              <Skeleton className='size-[min(64vw,38svh,17rem)] sm:size-60' />
            </div>
            <span
              aria-hidden
              className='absolute inset-x-4 bottom-0 border-b-2 border-dashed border-stroke sm:inset-x-auto sm:inset-y-4 sm:right-0 sm:bottom-auto sm:border-r-2 sm:border-b-0'
            />
          </div>

          <div className='flex flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-6'>
            <div className='grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-y-3'>
              <Field className='col-span-2' valueWidth='w-3/5' />
              <Field valueWidth='w-20' />
              <Field valueWidth='w-16' />
              <Field className='col-span-2' valueWidth='w-4/5' />
            </div>
            <Skeleton className='mt-auto h-9 w-full' />
          </div>
        </div>

        {/* Info del evento */}
        <div className='flex items-start gap-3 rounded-2xl border border-stroke p-3 sm:p-4'>
          <Skeleton className='aspect-square w-14 shrink-0 rounded-lg sm:w-16' />
          <div className='flex min-w-0 flex-1 flex-col gap-2'>
            <Skeleton className='h-4 w-1/2' />
            <Skeleton className='h-3 w-3/5' />
            <Skeleton className='h-3 w-4/5' />
          </div>
        </div>

        <div className='flex flex-col items-center gap-1.5'>
          <Skeleton className='h-3 w-full max-w-80' />
          <Skeleton className='h-3 w-full max-w-60' />
        </div>
      </main>
    </div>
  );
}

function Field({
  className,
  valueWidth,
}: {
  className?: string;
  valueWidth: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Skeleton className='h-3 w-12' />
      <Skeleton className={cn('h-4 sm:h-5', valueWidth)} />
    </div>
  );
}
