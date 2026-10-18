'use client';
import { isWithinInterval } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import EventCardContainer from '@/components/events/buyPage/EventCardContainer';
import { dateRanges } from '@/components/events/buyPage/EventFilter';
import { type RouterOutputs } from '@/server/routers/app';

type ActiveEvent = RouterOutputs['events']['getActive'][number];

function GridEvents({ events }: { events: ActiveEvent[] }) {
  const [dateRange] = useQueryState('date', parseAsString);
  const [search] = useQueryState('q', parseAsString);
  const [selectedCategory] = useQueryState('cat', parseAsString);

  const selectedDateRange = useMemo(() => {
    if (!dateRange) return null;
    return dateRanges.find((range) => range.id === dateRange);
  }, [dateRange]);

  const filteredEvents = useMemo(() => {
    const searchValue = search
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return events
      .filter((event) => {
        if (!searchValue) return true;
        return event.name.toLowerCase().includes(searchValue);
      })
      .filter((event) => {
        if (!selectedDateRange) return true;
        if (!event.startingDate) return false;
        return isWithinInterval(new Date(event.startingDate), {
          start: selectedDateRange.from,
          end: selectedDateRange.to,
        });
      })
      .filter((event) => {
        if (!selectedCategory) return true;
        return event.eventCategory?.id === selectedCategory;
      });
  }, [events, search, selectedDateRange, selectedCategory]);

  if (events.length === 0) {
    return (
      <div className='mx-5 max-w-full px-4 py-8 md:mx-12'>
        <h1 className='text-center text-2xl font-bold'>No hay eventos</h1>
      </div>
    );
  }

  return (
    <div className='mb-20 max-w-full p-4 sm:px-8 sm:py-8 md:px-12'>
      <div className='mx-auto grid w-full max-w-6xl grid-cols-2 place-content-start items-stretch justify-items-stretch gap-6 lg:grid-cols-4'>
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className='flex h-full w-full min-h-0 justify-center'
          >
            <EventCardContainer event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GridEvents;
