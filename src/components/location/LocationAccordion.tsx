import DeleteLocationModal from '@/components/location/DeleteLocationModal';
import LocationModal from '@/components/location/LocationModal';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { type Location } from '@/server/schemas/location';

export default function LocationAccordion({
  location,
  value,
}: {
  location: Location;
  value: string;
}) {
  return (
    <AccordionItem value={value} className='rounded-lg my-4'>
      <AccordionTrigger className='text-xl px-4'>
        {location.name}
      </AccordionTrigger>
      <AccordionContent
        contentClassName='w-full mt-2'
        className='text-lg relative flex flex-col max-w-full'
      >
        <p className='font-medium'>
          Ubicación: <span className='font-light'>{location.address}</span>
        </p>
        <p className='font-medium my-2'>
          Link a Maps:{' '}
          <span className='font-light'>
            <a
              href={location.googleMapsUrl}
              className='underline break-all'
              target='_blank'
            >
              {location.googleMapsUrl}
            </a>
          </span>
        </p>
        <p className='font-medium'>
          Capacidad: <span className='font-light'>{location.capacity}</span>
        </p>
        <LocationModal action='EDIT' location={location} />
        <DeleteLocationModal id={location.id} />
      </AccordionContent>
    </AccordionItem>
  );
}
