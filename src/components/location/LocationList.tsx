'use client';

import LocationAccordion from '@/components/location/LocationAccordion';
import LocationModal from '@/components/location/LocationModal';
import { Accordion } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/server/trpc/client';

export default function LocationList() {
  const { data: locations, isLoading } = trpc.location.getAll.useQuery();

  return (
    <div className='p-4'>
      <h2 className='text-2xl font-bold'>Locaciones</h2>
      {isLoading ? (
        <Skeleton className='h-40 w-full' />
      ) : (
        <>
          <Accordion type='multiple'>
            {locations &&
              locations.map((location, index) => (
                <LocationAccordion
                  location={location}
                  key={index}
                  value={index.toString()}
                />
              ))}
          </Accordion>
          <LocationModal action='CREATE' />
        </>
      )}
    </div>
  );
}
