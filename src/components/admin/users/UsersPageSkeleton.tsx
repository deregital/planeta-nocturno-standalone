import { AdminTableFrame } from '@/components/admin/AdminTableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function UsersPageSkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='flex min-w-0 flex-col gap-4 py-4'
    >
      <span className='sr-only'>Cargando organizadores</span>
      <div className='flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between'>
        <Skeleton className='h-9 w-52' />
        <div className='flex flex-wrap gap-2'>
          <Skeleton className='h-10 w-36' />
          <Skeleton className='h-10 w-44' />
        </div>
      </div>
      <div className='flex flex-col gap-4 px-4 md:flex-row md:items-end'>
        <div className='flex w-full flex-col gap-2 md:w-80'>
          <Skeleton className='h-4 w-72' />
          <Skeleton className='h-9 w-full' />
        </div>
        <div className='flex w-full gap-4 md:w-auto'>
          <div className='flex min-w-0 flex-1 flex-col gap-2 sm:w-48 sm:flex-none'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-9 w-full' />
          </div>
          <div className='flex min-w-0 flex-1 flex-col gap-2 sm:w-48 sm:flex-none'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-9 w-full' />
          </div>
        </div>
      </div>
      <AdminTableFrame columns={6} />
    </div>
  );
}
