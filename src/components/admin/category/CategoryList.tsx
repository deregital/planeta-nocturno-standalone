'use client';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEffect, useState } from 'react';

import EventCategoryCard from '@/components/category/EventCategoryCard';
import EventCategoryModal from '@/components/category/EventCategoryModal';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/server/trpc/client';

export default function CategoryList() {
  const { data: categories, isLoading } = trpc.eventCategory.getAll.useQuery();
  const utils = trpc.useUtils();

  const reorderMutation = trpc.eventCategory.reorder.useMutation({
    onError: () => {
      utils.eventCategory.getAll.invalidate();
    },
  });

  const [items, setItems] = useState(categories ?? []);

  useEffect(() => {
    if (categories) setItems(categories);
  }, [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex).map((item, i) => ({
      ...item,
      sortOrder: i,
    }));

    setItems(newItems);
    reorderMutation.mutate(
      newItems.map(({ id, sortOrder }) => ({ id, sortOrder })),
    );
  }

  return (
    <div className='p-4'>
      <h2 className='text-2xl font-bold'>Categorías</h2>
      {isLoading ? (
        <Skeleton className='h-20 w-full' />
      ) : (
        <>
          <div className='w-full overflow-x-auto scrollbar-none'>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((c) => c.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className='flex gap-4 mt-4 pb-1 sm:flex-wrap w-max sm:w-full'>
                  {items.map((category) => (
                    <EventCategoryCard category={category} key={category.id} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <EventCategoryModal action='CREATE' />
        </>
      )}
    </div>
  );
}
