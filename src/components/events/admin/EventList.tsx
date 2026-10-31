'use client';

import { type Route } from 'next';
import Link from 'next/link';
import { useMemo } from 'react';

import EventCardHorizontal, {
  type ListedEvent,
} from '@/components/events/admin/EventCardHorizontal';
import EventFolder from '@/components/events/admin/EventFolder';
import {
  EventListSortLockProvider,
  usePersonalListOrder,
} from '@/hooks/usePersonalListOrder';
import {
  EVENT_LIST_ROOT_KEY,
  type EventListScope,
} from '@/lib/event-list-order';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';

type EventGroup = RouterOutputs['events']['getAll'][
  | 'upcomingEvents'
  | 'pastEvents'];

type EventListType = {
  folders: Array<
    Omit<EventGroup['folders'][number], 'events'> & { events: ListedEvent[] }
  >;
  withoutFolders: ListedEvent[];
};

type RootFolder = EventListType['folders'][number];
type RootEvent = EventListType['withoutFolders'][number];

type RootItem =
  | {
      id: string;
      kind: 'folder';
      entityId: string;
      listPosition: number;
      folder: RootFolder;
    }
  | {
      id: string;
      kind: 'event';
      entityId: string;
      listPosition: number;
      event: RootEvent;
    };

function toRootItems(events: EventListType): RootItem[] {
  const folders: RootItem[] = events.folders.map((folder) => ({
    id: `folder:${folder.id}`,
    kind: 'folder',
    entityId: folder.id,
    listPosition: folder.listPosition ?? 0,
    folder,
  }));
  const loose: RootItem[] = events.withoutFolders.map((event, index) => ({
    id: `event:${event.id}`,
    kind: 'event',
    entityId: event.id,
    listPosition: event.listPosition ?? folders.length + index,
    event,
  }));

  return [...folders, ...loose].sort((a, b) => a.listPosition - b.listPosition);
}

export default function EventList(props: {
  events: EventListType;
  showActions?: true;
  href?: never;
  sortable?: boolean;
  scope?: EventListScope;
}): React.ReactElement;

export default function EventList(props: {
  events: EventListType;
  showActions: false;
  href: (slug: string) => string;
  sortable?: boolean;
  scope?: EventListScope;
}): React.ReactElement;

export default function EventList(props: {
  events: EventListType;
  showActions?: boolean;
  href?: (slug: string) => string;
  sortable?: boolean;
  scope?: EventListScope;
}) {
  return (
    <EventListSortLockProvider>
      <EventListBody {...props} />
    </EventListSortLockProvider>
  );
}

function EventListBody(props: {
  events: EventListType;
  showActions?: boolean;
  href?: (slug: string) => string;
  sortable?: boolean;
  scope?: EventListScope;
}) {
  const { events, href, showActions = true, sortable = false, scope } = props;
  const canSort = sortable && Boolean(scope);
  const serverItems = useMemo(() => toRootItems(events), [events]);
  const { ordered, draggedId, hoveredId, getItemProps, getHandleProps } =
    usePersonalListOrder({
      items: serverItems,
      enabled: canSort,
      scope,
      containerKey: EVENT_LIST_ROOT_KEY,
      toInput: (items) =>
        items.map((item) => ({ kind: item.kind, id: item.entityId })),
    });

  return (
    <ul className='flex flex-col gap-4'>
      {ordered.map((item) => {
        const handleProps = canSort ? getHandleProps(item) : undefined;
        const content =
          item.kind === 'folder' ? (
            <EventFolder
              folder={item.folder}
              href={href}
              showActions={showActions}
              sortable={canSort}
              scope={scope}
              dragHandleProps={handleProps}
            />
          ) : href && !canSort ? (
            <Link href={href(item.event.slug) as Route}>
              <EventCardHorizontal
                event={item.event}
                showActions={showActions}
              />
            </Link>
          ) : (
            <EventCardHorizontal
              event={item.event}
              showActions={showActions}
              dragHandleProps={handleProps}
            />
          );

        return (
          <li
            key={item.id}
            {...(canSort ? getItemProps(item) : {})}
            className={cn(
              'rounded-lg',
              canSort && draggedId === item.id && 'opacity-60',
              canSort &&
                hoveredId === item.id &&
                draggedId !== item.id &&
                'ring-2 ring-accent/40',
            )}
          >
            {content}
          </li>
        );
      })}
    </ul>
  );
}
