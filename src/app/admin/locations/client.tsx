'use client';

import CreateLocationModal from '@/components/location/CreateLocationModal';
import LocationAccordion from '@/components/location/LocationAccordion';
import { Accordion } from '@/components/ui/accordion';
import { Location } from '@/server/schemas/location';

export default function Client({ locations }: { locations: Location[] }) {
  return (
    <>
      <h1 className='text-3xl font-bold'>Locaciones</h1>
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
      <CreateLocationModal />
    </>
  );
}
