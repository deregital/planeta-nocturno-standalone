import { AdminTableFrame } from '@/components/admin/AdminTableSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function DatabasePageSkeleton() {
  return (
    <div
      aria-busy='true'
      aria-live='polite'
      className='flex flex-col gap-4 py-4'
    >
      <span className='sr-only'>Cargando base de datos</span>
      <Skeleton className='mx-4 h-9 w-52' />
      <div className='flex flex-col gap-4 px-4 md:flex-row md:items-end'>
        <div className='flex w-full flex-col gap-2 md:w-80'>
          <Skeleton className='h-4 w-64' />
          <Skeleton className='h-9 w-full' />
        </div>
        <div className='flex w-full flex-col gap-2 md:w-56'>
          <Skeleton className='h-4 w-48' />
          <Skeleton className='h-9 w-full' />
        </div>
        <Skeleton className='h-4 w-36' />
      </div>
      <AdminTableFrame columns={6} />
    </div>
  );
}
