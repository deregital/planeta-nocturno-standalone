import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizerSkeleton() {
  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex gap-4'>
        <Skeleton className='w-64 h-12' />
        <Skeleton className='w-32 h-12' />
      </div>
      <Skeleton className='w-full h-56' />
    </div>
  );
}
