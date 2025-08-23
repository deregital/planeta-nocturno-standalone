import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { type Location } from '@/server/schemas/location';
import DeleteLocationModal from '@/components/location/DeleteLocationModal';
import LocationModal from '@/components/location/LocationModal';

export default function LocationAccordion({
  location,
  value,
}: {
  location: Location;
  value: string;
}) {
  return (
    <AccordionItem
      value={value}
      className='border last:border border-pn-gray rounded-lg px-4 my-4'
    >
      <AccordionTrigger className='text-xl'>{location.name}</AccordionTrigger>
      <AccordionContent className='text-lg relative pb-4'>
        <p className='font-medium'>
          Ubicación: <span className='font-light'>{location.address}</span>
        </p>
        <p className='font-medium'>
          Link a Maps:{' '}
          <span className='font-light'>
            <a
              href={location.googleMapsUrl}
              className='underline'
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
