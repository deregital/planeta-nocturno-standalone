'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import EventCategoryModal from '@/components/category/EventCategoryModal';
import { Switch } from '@/components/ui/switch';
import { type EventCategory } from '@/server/schemas/event-category';
import { trpc } from '@/server/trpc/client';

type Category = EventCategory & { isActive?: boolean; sortOrder?: number };

export default function EventCategoryCard({
  category,
}: {
  category: Category;
}) {
  const utils = trpc.useUtils();
  const toggleMutation = trpc.eventCategory.toggleActive.useMutation({
    onSuccess: (_, vars) => {
      utils.eventCategory.getAll.invalidate();
      utils.eventCategory.getActive.invalidate();
      toast.success(
        vars.isActive ? 'Categoría activada' : 'Categoría desactivada',
      );
    },
    onError: () => {
      toast.error('Error al actualizar la categoría');
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = category.isActive ?? false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='shrink-0 rounded-md p-2 flex gap-3 items-center bg-accent text-on-accent pl-2'
    >
      <button
        className='cursor-grab active:cursor-grabbing touch-none text-on-accent/50 hover:text-on-accent'
        {...attributes}
        {...listeners}
      >
        <GripVertical className='size-4' />
      </button>

      <div className='relative'>
        <Switch
          checked={isActive}
          disabled={toggleMutation.isPending}
          className='cursor-pointer'
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ id: category.id, isActive: checked })
          }
        />
        {toggleMutation.isPending && (
          <Loader2 className='absolute inset-0 m-auto size-3 animate-spin pointer-events-none' />
        )}
      </div>

      <span className={isActive ? '' : 'opacity-50 line-through'}>
        {category.name}
      </span>
      <EventCategoryModal action='EDIT' category={category} />
    </div>
  );
}
