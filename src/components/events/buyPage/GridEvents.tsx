'use client';
import { isWithinInterval } from 'date-fns';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import EventCardContainer from '@/components/events/buyPage/EventCardContainer';
import { dateRanges } from '@/components/events/buyPage/EventFilter';
import { trpc } from '@/server/trpc/client';

function GridEvents() {
  const { data, isLoading } = trpc.events.getActive.useQuery();
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

    return data
      ?.filter((event) => {
        if (!searchValue) return true;
        return event.name.toLowerCase().includes(searchValue);
      })
      .filter((event) => {
        if (!selectedDateRange) return true;
        return isWithinInterval(event.startingDate, {
          start: selectedDateRange?.from,
          end: selectedDateRange?.to,
        });
      })
      .filter((event) => {
        if (!selectedCategory) return true;
        return event.eventCategory?.id === selectedCategory;
      });
  }, [data, search, selectedDateRange, selectedCategory]);

  if (isLoading) {
    return (
      <div className='max-w-7xl mx-auto py-8 px-4'>
        <h1 className='text-2xl font-bold select-none'>Cargando eventos...</h1>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='max-w-full mx-5 md:mx-12 py-8 px-4'>
        <h1 className='text-2xl font-bold text-center'>No hay eventos</h1>
      </div>
    );
  }

  return (
    <div className='max-w-full p-4 sm:px-8 sm:py-8 md:px-12 mb-20 '>
      <div className='grid w-full max-w-6xl grid-cols-2 lg:grid-cols-4 mx-auto gap-6 place-content-start items-stretch justify-items-stretch'>
        {filteredEvents?.map((event) => (
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
