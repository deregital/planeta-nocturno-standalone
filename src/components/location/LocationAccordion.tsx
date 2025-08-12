import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Location } from '@/server/schemas/location';
import { Pencil } from 'lucide-react';
import DeleteLocationModal from './DeleteLocationModal';

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
        <Button variant='ghost' className='absolute top-0 right-0'>
          <Pencil />
        </Button>
        <DeleteLocationModal id={location.id} />
      </AccordionContent>
    </AccordionItem>
  );
}
