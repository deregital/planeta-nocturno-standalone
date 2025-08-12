import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Location } from '@/server/schemas/location';
import DeleteLocationModal from './DeleteLocationModal';
import UpdateLocationModal from './UpdateLocationModal';

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
      className='border last:border border-pn-gray rounded-lg px-4 pb-4 my-4'
    >
      <AccordionTrigger className='text-xl'>{location.name}</AccordionTrigger>
      <AccordionContent className='text-lg relative pb-0'>
        <p className='font-medium'>
          Ubicación: <span className='font-light'>{location.address}</span>
        </p>
        <p className='font-medium'>
          Link a Maps:{' '}
          <span className='font-light'>{location.googleMapsUrl}</span>
        </p>
        <p className='font-medium'>
          Capacidad: <span className='font-light'>{location.capacity}</span>
        </p>
        <UpdateLocationModal location={location} />
        <DeleteLocationModal id={location.id} />
      </AccordionContent>
    </AccordionItem>
  );
}
