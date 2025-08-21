import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { trpc } from '@/server/trpc/server';
import { formatInTimeZone } from 'date-fns-tz';
import { CalendarIcon, ClockIcon, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { ScanTicketModal } from '@/components/event/individual/ScanTicketModal';

// Separate async component that can be suspended
async function EventDetails({ slug }: { slug: string }) {
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  return (
    <div className='flex flex-col items-center mt-4'>
      <Image
        width={1000}
        height={1000}
        quality={100}
        src={event.coverImageUrl}
        className='max-h-96 h-36 aspect-auto rounded-md w-fit max-w-full'
        alt='Event cover'
      />
      <div className='col-span-3 p-2'>
        <h3 className='text-center text-2xl font-bold'>{event?.name}</h3>
      </div>
      <div className='flex flex-wrap items-center justify-center gap-x-3 pb-3'>
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
        <QuantityTicketsEmitted event={event} />
        <ScanTicketModal eventId={event.id} />
      </div>
    </div>
  );
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EventDetails slug={slug} />
    </Suspense>
  );
}
