'use client';
import { trpc } from '@/server/trpc/client';
import EventCardContainer from './EventCardContainer';

function GridEvents() {
  const { data, isLoading } = trpc.events.getActive.useQuery();

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
    <div className='max-w-full mx-5 md:mx-[3rem] py-4 sm:py-8'>
      <div className='flex flex-wrap gap-6 items-center'>
        {data.map((event) => (
          <div key={event.id}>
            <EventCardContainer event={event} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GridEvents;
