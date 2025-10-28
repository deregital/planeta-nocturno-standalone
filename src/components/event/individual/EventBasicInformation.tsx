import { formatInTimeZone } from 'date-fns-tz';
import { CalendarIcon, ClockIcon, MapPin } from 'lucide-react';
import Image from 'next/image';

import { type RouterOutputs } from '@/server/routers/app';

export function EventBasicInformation({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  return (
    <div>
      <Image
        width={1000}
        height={1000}
        quality={100}
        src={event.coverImageUrl}
        className='max-h-96 h-36 aspect-auto rounded-md w-fit max-w-full mx-auto'
        alt='Event cover'
      />
      <div className='col-span-3 p-2'>
        <h3 className='text-center text-2xl font-bold text-accent'>
          {event?.name}
        </h3>
      </div>
      <div className='flex flex-wrap items-center justify-center gap-x-3 pb-3 text-accent'>
        <h3 className='flex items-center gap-x-1 p-2 text-center align-middle text-sm sm:text-base'>
          <CalendarIcon className='inline h-5 w-5' />
          {formatInTimeZone(
            event!.startingDate,
            'America/Argentina/Buenos_Aires',
            'dd/MM/yyyy',
          )}
        </h3>
        <h3 className='flex items-center gap-x-1 p-2 text-center align-middle text-sm sm:text-base'>
          <ClockIcon className='inline h-5 w-5' />
          {formatInTimeZone(
            event!.startingDate,
            'America/Argentina/Buenos_Aires',
            'HH:mm',
          )}{' '}
          -{' '}
          {formatInTimeZone(
            event!.endingDate,
            'America/Argentina/Buenos_Aires',
            'HH:mm',
          )}
        </h3>
        <h3 className='flex items-center p-2 text-center text-sm sm:text-base'>
          <MapPin className='inline h-5 w-5' />
          {event?.location.address}
        </h3>
      </div>
    </div>
  );
}
