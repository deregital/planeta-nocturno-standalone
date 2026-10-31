import { AdminTableFrame } from '@/components/admin/AdminTableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

const ACTION_BUTTONS = 4;
const TICKET_TABS = 3;

export default function AdminEventDetailSkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='relative mt-4 flex flex-col items-center'
    >
      <span className='sr-only'>Cargando evento</span>
      <div className='absolute top-0 left-0 px-4'>
        <Skeleton className='size-9' />
      </div>
      <div className='mt-4 flex w-full flex-col items-center gap-3 px-4'>
        <Skeleton className='h-36 w-full max-w-md rounded-md' />
        <Skeleton className='h-8 w-64 max-w-full' />
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <Skeleton className='h-5 w-28' />
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-5 w-40' />
        </div>
        <Skeleton className='h-5 w-full max-w-xl' />
      </div>
      <div className='mt-4 grid grid-cols-2 gap-2 px-4 md:flex md:gap-x-2'>
        {Array.from({ length: ACTION_BUTTONS }, (_, index) => (
          <Skeleton key={index} className='h-9 w-full md:w-28' />
        ))}
      </div>
      <div className='w-full px-4'>
        <Skeleton className='my-4 h-9 w-56' />
      </div>
      <Skeleton className='mx-4 h-9 w-full max-w-md self-start' />
      <div className='mx-auto mt-4 flex w-full max-w-[98%] gap-2 overflow-hidden'>
        {Array.from({ length: TICKET_TABS }, (_, index) => (
          <Skeleton key={index} className='h-9 w-40 shrink-0' />
        ))}
      </div>
      <div className='mt-2 w-full'>
        <AdminTableFrame />
      </div>
    </div>
  );
}
