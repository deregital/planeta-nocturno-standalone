import { Skeleton } from '@/components/ui/skeleton';

const TICKET_ROWS = 3;

export default function EventPageSkeleton() {
  return (
    <div aria-busy='true' aria-live='polite'>
      <span className='sr-only'>Cargando evento</span>
      <div className='mx-4 my-4 flex'>
        <Skeleton className='size-9 rounded-md' />
      </div>
      <div className='my-6 flex justify-center px-1 sm:px-4'>
        <main className='h-fit w-full max-w-[calc(100%-2rem)] overflow-hidden rounded-3xl border border-stroke/20 sm:max-w-[calc(100%-5rem)] lg:max-w-6xl'>
          <div className='overflow-hidden border-b border-stroke/15'>
            <div className='relative w-full md:pr-36 lg:pr-44'>
              <div className='grid min-w-0 w-full grid-cols-1 md:grid-cols-[7fr_2fr] md:items-stretch'>
                <div className='border-b border-stroke/15 px-4 py-3 md:border-b-0 lg:px-6 lg:py-4'>
                  <div className='flex flex-row items-start gap-3 sm:gap-4'>
                    <div className='min-w-0 flex-1 space-y-2'>
                      <Skeleton className='h-7 w-3/5' />
                      <Skeleton className='h-4 w-2/5' />
                    </div>
                    <Skeleton className='aspect-square w-20 shrink-0 rounded-lg sm:w-24 md:hidden' />
                  </div>
                </div>
                <div className='flex items-center px-4 py-3 md:border-l md:border-stroke/15 md:px-3 lg:px-4 lg:py-4'>
                  <Skeleton className='h-4 w-4/5' />
                </div>
              </div>
              <div className='pointer-events-none absolute inset-y-0 right-0 hidden w-36 items-center justify-end bg-white py-3 pr-0 pl-2 md:flex lg:w-44 lg:py-4 lg:pl-3'>
                <Skeleton className='aspect-square w-28 rounded-l-xl rounded-r-none lg:w-32' />
              </div>
            </div>
          </div>

          <div className='mt-6 flex flex-col overflow-hidden md:grid md:grid-cols-16'>
            <div className='order-2 px-4 pb-4 md:order-0 md:col-span-12 md:px-6'>
              <div className='flex h-full flex-col rounded-[20px] border border-stroke/15 bg-accent-ultra-light p-6'>
                <div className='hidden items-center border-b border-stroke/15 pb-2 sm:flex'>
                  <Skeleton className='h-4 flex-1 bg-white/70' />
                  <Skeleton className='ml-4 h-4 w-24 bg-white/70' />
                  <Skeleton className='ml-4 h-4 w-24 bg-white/70' />
                </div>
                <div className='flex flex-col gap-4 py-4'>
                  {Array.from({ length: TICKET_ROWS }, (_, index) => (
                    <div
                      key={index}
                      className='flex flex-col gap-2 sm:flex-row sm:items-center'
                    >
                      <div className='flex min-w-0 flex-1 gap-3'>
                        <Skeleton className='size-14 shrink-0 rounded-md bg-white/70 sm:size-16' />
                        <div className='flex flex-1 flex-col justify-center gap-2'>
                          <Skeleton className='h-4 w-2/3 bg-white/70' />
                          <Skeleton className='h-3 w-1/2 bg-white/70' />
                        </div>
                      </div>
                      <Skeleton className='h-4 w-16 bg-white/70 sm:w-24' />
                      <Skeleton className='h-9 w-24 rounded-md bg-white/70' />
                    </div>
                  ))}
                </div>
                <Skeleton className='mt-4 h-9 w-full max-w-40 bg-white/70' />
              </div>
            </div>
            <div className='order-1 flex flex-col px-3 sm:px-4 md:order-0 md:col-span-4 md:px-4'>
              <div className='mb-2 flex w-full flex-col gap-3 p-2 md:mb-0 md:items-center md:px-4 md:py-6'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-4/5' />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
