'use client';

import { Folder } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import EventCardHorizontal from '@/components/events/admin/EventCardHorizontal';
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

type FolderEvents = RouterOutputs['events']['getAll'][
  | 'pastEvents'
  | 'upcomingEvents']['folders'][number];

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
        <div className='flex items-stretch'>
          {dragHandleProps ? (
            <EventListDragHandle
              {...dragHandleProps}
              className='rounded-l-lg px-2'
              style={{ backgroundColor: folder.color }}
            />
          ) : null}
          <div className='relative min-w-0 flex-1'>
            <AccordionTrigger
              className={cn(
                'hover:no-underline py-3 px-4 gap-2 transition-all duration-200 ease-in-out flex items-center justify-between',
                dragHandleProps ? 'rounded-l-none rounded-r-lg' : 'rounded-lg',
                isEmpty
                  ? 'cursor-default disabled:opacity-100'
                  : 'cursor-pointer',
              )}
              style={{ backgroundColor: folder.color }}
            >
              <div className='flex items-center gap-2'>
                <Folder size={20} />
                <p className='text-lg font-bold'>
                  {folder.name}{' '}
                  {isEmpty && <span className='text-xs'>(sin eventos)</span>}
                </p>
              </div>
            </AccordionTrigger>
            {canManageFolders && (
              <div className='absolute right-10 top-1/2 -translate-y-1/2'>
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
