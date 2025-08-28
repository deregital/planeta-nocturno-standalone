import { formatInTimeZone } from 'date-fns-tz';
import { CalendarIcon, ClockIcon, Loader2, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { trpc } from '@/server/trpc/server';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { ScanTicketModal } from '@/components/event/individual/ScanTicketModal';
import { EmitTicketModal } from '@/components/event/individual/EmitTicketModal';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ToggleActivateButton } from '@/components/event/individual/ToggleActivateButton';

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
        <QuantityTicketsEmitted event={event} />
      </div>
      <div className='flex flex-row gap-x-2'>
        <ScanTicketModal eventId={event.id} />
        <EmitTicketModal event={event} />
        <ToggleActivateButton event={event} />
      </div>
      <TicketTableWithTabs ticketTypes={event.ticketTypes} />
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
    <Suspense
      fallback={
        <div className='flex h-full w-full items-center justify-center'>
          <Loader2 className='animate-spin' />
        </div>
      }
    >
      <NuqsAdapter>
        <EventDetails slug={slug} />
      </NuqsAdapter>
    </Suspense>
  );
}
