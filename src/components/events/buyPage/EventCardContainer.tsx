'use client';
import Link from 'next/link';

import CardEvent from '@/components/events/buyPage/CardEvent';
import { formatEventDate } from '@/lib/utils';

type Event = {
  name: string;
  slug: string;
  coverImageUrl: string | null;
  startingDate: string | null;
};

interface EventCardContainerProps {
  event: Event;
}

function EventCardContainer({ event }: EventCardContainerProps) {
  const formatted = event.startingDate
    ? formatEventDate(event.startingDate)
    : null;

  const cardEvent = (
    <CardEvent
      title={event.name}
      dayOfWeek={formatted?.dayOfWeek}
      date={formatted?.day}
      month={formatted?.month}
      year={formatted?.year}
      time={formatted?.time}
      imageUrl={event.coverImageUrl || '/Foto.png'}
    />
  );

  return (
    <Link
      href={`/event/${event.slug}`}
      className='flex h-full min-h-0 w-full flex-col max-w-52 sm:max-w-64'
    >
      {cardEvent}
    </Link>
  );
}

export default EventCardContainer;
