import { Skeleton } from '@/components/ui/skeleton';

export function StatisticsSkeleton() {
  return (
    <>
      <Skeleton className='sm:col-span-2 sm:row-span-1 lg:row-span-2 lg:row-start-1 col-span-2 flex justify-center items-center'></Skeleton>
      <Skeleton className='sm:col-start-1 sm:row-span-3 sm:col-span-2 sm:row-start-2 lg:row-span-5 p-12 gap-8 justify-center items-center'></Skeleton>
      <Skeleton className='sm:row-start-5 sm:row-span-3 lg:grid-start-3 lg:row-span-7 lg:row-start-1 flex flex-col justify-start items-center px-4 py-8'></Skeleton>
      <Skeleton className='sm:row-start-5 sm:row-span-3 lg:grid-start-3 lg:row-span-7 lg:row-start-1 flex flex-col justify-start items-center px-4 py-8'></Skeleton>
    </>
  );
}

export function ComparativeTableSkeleton() {
  return (
    <>
      <div className='flex gap-4 px-12'>
        <Skeleton className='w-40 h-8'></Skeleton>
        <Skeleton className='w-40 h-8'></Skeleton>
      </div>
      <Skeleton className='w-full h-48'></Skeleton>
    </>
  );
}
