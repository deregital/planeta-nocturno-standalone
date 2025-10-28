import { Loader2 } from 'lucide-react';
import { SessionProvider } from 'next-auth/react';
import { notFound } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';

import GoBack from '@/components/common/GoBack';
import DeleteEventModal from '@/components/event/individual/DeleteEventModal';
import { EmitTicketModal } from '@/components/event/individual/EmitTicketModal';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ToggleActivateButton } from '@/components/event/individual/ToggleActivateButton';
import { trpc } from '@/server/trpc/server';
import { ScanTicket } from '@/components/event/individual/ScanTicket';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';

async function EventDetails({ slug }: { slug: string }) {
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  return (
    <div className='flex flex-col items-center mt-4'>
      <div className='flex w-full px-4'>
        <GoBack route='/admin/event' />
      </div>
      <div className='flex flex-col items-center mt-4'>
        <EventBasicInformation event={event} />
        <QuantityTicketsEmitted event={event} />
      </div>
      <SessionProvider>
        <div className='flex justify-between w-full px-4'>
          <div className='flex-1 flex justify-center items-center'>
            <div className='md:flex md:gap-x-2 md:items-center grid grid-cols-2 gap-2 md:grid-cols-none'>
              <div className='md:order-1 order-3'>
                <DeleteEventModal event={event} />
              </div>
              <div className='md:order-2 order-1'>
                <ScanTicket eventId={event.id} eventSlug={event.slug} />
              </div>
              <div className='md:order-3 order-2'>
                <EmitTicketModal event={event} />
              </div>
              <div className='md:order-4 order-4'>
                <ToggleActivateButton event={event} />
              </div>
            </div>
          </div>
        </div>
        <TicketTableWithTabs ticketTypes={event.ticketTypes} />
      </SessionProvider>
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
