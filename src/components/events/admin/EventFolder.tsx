'use client';

import { Folder } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import EventCardHorizontal, {
  type ListedEvent,
} from '@/components/events/admin/EventCardHorizontal';
import EventFolderModal from '@/components/events/admin/EventFolderModal';
import EventListDragHandle from '@/components/events/admin/EventListDragHandle';
import { useCan } from '@/components/rbac/PermissionsProvider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { usePersonalListOrder } from '@/hooks/usePersonalListOrder';
import { type SortableHandleProps } from '@/hooks/useSortableList';
import { type EventListScope } from '@/lib/event-list-order';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

type FolderEvents = Omit<
  RouterOutputs['events']['getAll'][
    | 'pastEvents'
    | 'upcomingEvents']['folders'][number],
  'events'
> & { events: ListedEvent[] };

export default function EventFolder({
  folder,
  href,
  showActions,
  sortable = false,
  scope,
  dragHandleProps,
}: {
  folder: FolderEvents;
  href?: (slug: string) => string;
  showActions?: boolean;
  sortable?: boolean;
  scope?: EventListScope;
  dragHandleProps?: SortableHandleProps;
}) {
  const canManageFolders = useCan('events:folders');
  const canSort = sortable && Boolean(scope);
  const { ordered, draggedId, hoveredId, getItemProps, getHandleProps } =
    usePersonalListOrder({
      items: folder.events,
      enabled: canSort,
      scope,
      containerKey: folder.id,
      toInput: (events) =>
        events.map((event) => ({ kind: 'event' as const, id: event.id })),
    });

  const isEmpty = ordered.length === 0;

  return (
    <Accordion type='single' collapsible className='w-full'>
      <AccordionItem value='item-1' className='border-none' disabled={isEmpty}>
        <div className='flex min-w-0 items-stretch'>
          {dragHandleProps ? (
            <EventListDragHandle
              {...dragHandleProps}
              className='w-7 shrink-0 rounded-l-lg px-1'
              style={{ backgroundColor: folder.color }}
            />
          ) : null}
          <div className='relative min-w-0 flex-1'>
            <AccordionTrigger
              className={cn(
                'min-w-0 gap-2 py-3 pr-3 transition-all duration-200 ease-in-out hover:no-underline flex items-center justify-between',
                dragHandleProps
                  ? 'rounded-l-none rounded-r-lg pl-1'
                  : 'rounded-lg pl-4',
                isEmpty
                  ? 'cursor-default disabled:opacity-100'
                  : 'cursor-pointer',
              )}
              style={{ backgroundColor: folder.color }}
            >
              <div
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-1.5',
                  canManageFolders && 'pr-10',
                )}
              >
                <Folder className='size-5 shrink-0' />
                <p className='flex min-w-0 flex-1 items-center gap-1 font-bold'>
                  <span className='min-w-0 truncate text-[clamp(0.875rem,0.8rem+0.45vw,1.125rem)] leading-tight'>
                    {folder.name}
                  </span>
                  {isEmpty && (
                    <span className='shrink-0 text-xs font-medium'>
                      (sin eventos)
                    </span>
                  )}
                </p>
              </div>
            </AccordionTrigger>
            {canManageFolders && (
              <div className='absolute top-1/2 right-9 z-10 -translate-y-1/2'>
                <EventFolderModal action='EDIT' folder={folder} />
              </div>
            )}
          </div>
        </div>
        <AccordionContent
          data-sortable-nested={canSort ? '' : undefined}
          contentClassName='mt-0 border-none rounded-none w-full ml-2'
          className='p-2 bg-transparent space-y-2'
        >
          <ul className='flex flex-col gap-2'>
            {ordered.map((event) => {
              const card = (
                <EventCardHorizontal
                  event={event}
                  showActions={showActions}
                  folderColor={folder.color}
                  dragHandleProps={canSort ? getHandleProps(event) : undefined}
                />
              );

              if (!canSort) {
                return href ? (
                  <li key={event.id}>
                    <Link href={href(event.slug) as Route}>{card}</Link>
                  </li>
                ) : (
                  <li key={event.id}>{card}</li>
                );
              }

              return (
                <li
                  key={event.id}
                  {...getItemProps(event)}
                  className={cn(
                    'rounded-lg',
                    draggedId === event.id && 'opacity-60',
                    hoveredId === event.id &&
                      draggedId !== event.id &&
                      'ring-2 ring-accent/40',
                  )}
                >
                  {card}
                </li>
              );
            })}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
