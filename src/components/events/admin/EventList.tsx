import React from 'react';
import Link from 'next/link';
import { type Route } from 'next';

import EventCardHorizontal from '@/components/events/admin/EventCardHorizontal';
import { type RouterOutputs } from '@/server/routers/app';

type EventListType = RouterOutputs['events']['getAll'][
  | 'upcomingEvents'
  | 'pastEvents'];

// Overloads para manejar los diferentes casos
export default function EventList(props: {
  events: EventListType;
  showActions?: true;
  href?: never;
}): React.ReactElement;

export default function EventList(props: {
  events: EventListType;
  showActions: false;
  href: (id: string) => string;
}): React.ReactElement;

// Implementación
export default function EventList(props: {
  events: EventListType;
  showActions?: boolean;
  href?: (id: string) => string;
}) {
  const { events, href, showActions = true } = props;
  return (
    <div className='flex flex-col gap-4'>
      {events.map((event, index) =>
        href ? (
          <Link href={href(event.id) as Route} key={index}>
            <EventCardHorizontal
              key={index}
              event={event}
              showActions={showActions}
            />
          </Link>
        ) : (
          <EventCardHorizontal
            key={index}
            event={event}
            showActions={showActions}
          />
        ),
      )}
    </div>
  );
}
