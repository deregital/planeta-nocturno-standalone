import { Skeleton } from '@/components/ui/skeleton';

const CARD_PLACEHOLDERS = 8;

export default function TicketeraHomeSkeleton() {
  return (
    <div aria-busy='true' aria-live='polite'>
      <span className='sr-only'>Cargando eventos</span>
      <div className='flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-md bg-gray-300 p-2'>
        <div className='flex gap-2'>
          <Skeleton className='h-9 flex-1 bg-white/70' />
          <Skeleton className='h-9 w-full max-w-48 bg-white/70 md:max-w-2xs' />
        </div>
        <div className='mt-2 flex gap-2 overflow-hidden pb-1'>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              className='h-8 w-24 shrink-0 rounded-full bg-white/70'
            />
          ))}
        </div>
      </div>
      <div className='mb-20 max-w-full p-4 sm:px-8 sm:py-8 md:px-12'>
        <div className='mx-auto grid w-full max-w-6xl grid-cols-2 place-content-start items-stretch justify-items-stretch gap-6 lg:grid-cols-4'>
          {Array.from({ length: CARD_PLACEHOLDERS }, (_, index) => (
            <div key={index} className='flex h-full w-full justify-center'>
              <div className='flex h-full w-full max-w-52 flex-col overflow-hidden rounded-3xl bg-white drop-shadow-md sm:max-w-64'>
                <Skeleton className='h-32 w-full rounded-none sm:h-48' />
                <div className='flex flex-1 flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-5'>
                  <Skeleton className='h-4 w-4/5' />
                  <Skeleton className='h-4 w-3/5' />
                  <Skeleton className='mt-2 h-8 w-full' />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
