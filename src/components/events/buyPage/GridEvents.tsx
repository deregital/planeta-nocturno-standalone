'use client';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { isWithinInterval } from 'date-fns';

import { trpc } from '@/server/trpc/client';
import EventCardContainer from '@/components/events/buyPage/EventCardContainer';
import { dateRanges } from '@/components/events/buyPage/EventFilter';

function GridEvents() {
  const { data, isLoading } = trpc.events.getActive.useQuery();
  const [dateRange] = useQueryState('date', parseAsString);
  const [search] = useQueryState('q', parseAsString);

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
      });
  }, [data, search, selectedDateRange]);

  if (isLoading) {
    return (
      <div className='max-w-7xl mx-auto py-8 px-4'>
        <h1 className='text-2xl font-bold select-none'>Cargando eventos...</h1>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='max-w-full mx-5 md:mx-[3rem] py-8 px-4'>
        <h1 className='text-2xl font-bold text-center'>No hay eventos</h1>
      </div>
    );
  }

  return (
    <div className='max-w-full py-4 sm:py-8 mb-20'>
      <div className='grid grid-cols-2 md:grid-cols-3 place-content-center lg:grid-cols-3 xl:grid-cols-4 gap-6'>
        {filteredEvents?.map((event) => (
          <div key={event.id} className='justify-self-center'>
            <EventCardContainer event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GridEvents;
