'use client';

import { arrayMove } from '@dnd-kit/sortable';
import { format } from 'date-fns';
import { BadgeCheck, GripVertical, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { useSortableList } from '@/hooks/useSortableList';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

type ActiveEvent = RouterOutputs['events']['getActiveForOrdering'][number];

export default function ActiveEventsOrder() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.events.getActiveForOrdering.useQuery();
  const [draft, setDraft] = useState<ActiveEvent[] | null>(null);

  const orderedEvents = draft ?? data ?? [];
  const isDirty = draft !== null;

  const reorderActive = trpc.events.reorderActive.useMutation({
    onSuccess: async () => {
      toast.success('Orden guardado');
      await Promise.all([
        utils.events.getActiveForOrdering.invalidate(),
        utils.events.getActive.invalidate(),
      ]);
      setDraft(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const { draggedId, hoveredId, getItemProps } = useSortableList({
    items: orderedEvents,
    onReorder: (activeId, overId) => {
      setDraft((current) => {
        const items = current ?? data ?? [];
        const fromIndex = items.findIndex((e) => e.id === activeId);
        const toIndex = items.findIndex((e) => e.id === overId);
        if (fromIndex === -1 || toIndex === -1) return current;
        return arrayMove(items, fromIndex, toIndex);
      });
    },
    isEnabled: () => !reorderActive.isPending,
  });

  if (isLoading) {
    return (
      <div className='flex justify-center py-4'>
        <Loader2 className='size-6 animate-spin text-accent' />
      </div>
    );
  }

  if (orderedEvents.length === 0) {
    return (
      <p className='text-lg font-medium text-accent'>
        No hay eventos activos en la ticketera
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <ul className='flex flex-col gap-y-2'>
        {orderedEvents.map((event, index) => (
          <li
            key={event.id}
            {...getItemProps(event)}
            className={cn(
              'rounded-lg cursor-grab active:cursor-grabbing',
              draggedId === event.id ? 'opacity-60' : '',
              hoveredId === event.id && draggedId !== event.id
                ? 'ring-2 ring-accent/40'
                : '',
            )}
          >
            <Card
              variant='accent'
              className='flex flex-row items-center rounded-lg py-2 h-20 sm:h-auto sm:min-h-14'
            >
              <CardContent className='flex w-full min-w-0 items-center gap-3 px-4 text-on-accent'>
                <GripVertical className='size-4 shrink-0' />
                <span className='w-5 shrink-0 text-sm font-bold'>
                  {index + 1}
                </span>
                <div className='flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <BadgeCheck className='size-4 shrink-0 text-on-accent' />
                    <CardTitle className='truncate'>{event.name}</CardTitle>
                  </div>
                  <p className='truncate text-sm'>
                    {event.startingDate
                      ? format(event.startingDate, 'dd/MM/yyyy HH:mm')
                      : null}
                    <span className='hidden sm:inline'>
                      {event.startingDate && event.location?.address
                        ? ' - '
                        : ''}
                      {event.location?.address}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {isDirty && (
        <div className='flex justify-end gap-2'>
          <Button
            variant='ghost'
            disabled={reorderActive.isPending}
            onClick={() => setDraft(null)}
          >
            Descartar
          </Button>
          <Button
            disabled={reorderActive.isPending}
            onClick={() =>
              reorderActive.mutate(orderedEvents.map((event) => event.id))
            }
          >
            {reorderActive.isPending && <Loader2 className='animate-spin' />}
            Guardar orden
          </Button>
        </div>
      )}
    </div>
  );
}
