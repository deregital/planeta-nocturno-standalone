'use client';
import Link from 'next/link';

import { formatEventDate } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import CardEvent from '@/components/events/buyPage/CardEvent';

type Event = RouterOutputs['events']['getAll'][number];

interface EventCardContainerProps {
  event: Event;
}

function EventCardContainer({ event }: EventCardContainerProps) {
  const { day, month, year, time, dayOfWeek } = formatEventDate(
    event.startingDate,
  );

  const cardEvent = (
    <CardEvent
      title={event.name}
      dayOfWeek={dayOfWeek}
      date={day}
      month={month}
      year={year}
      time={time}
      imageUrl={event.coverImageUrl || '/Foto.png'}
    />
  );

  return <Link href={`/event/${event.slug}`}>{cardEvent}</Link>;
}

export default EventCardContainer;
