'use client';
import EventCategoryCard from '@/components/category/EventCategoryCard';
import EventCategoryModal from '@/components/category/EventCategoryModal';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/server/trpc/client';

export default function CategoryList() {
  const { data: categories, isLoading } = trpc.eventCategory.getAll.useQuery();

  return (
    <div className='p-4'>
      <h2 className='text-2xl font-bold'>Categorías</h2>
      {isLoading ? (
        <Skeleton className='h-20 w-full' />
      ) : (
        <>
          <EventCategoryModal action='CREATE' />
          <div className='flex flex-wrap gap-4'>
            {categories &&
              categories.map((category, index) => (
                <EventCategoryCard category={category} key={index} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
