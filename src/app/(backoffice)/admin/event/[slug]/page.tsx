import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';

import GoBack from '@/components/common/GoBack';
import DeleteEventModal from '@/components/event/individual/DeleteEventModal';
import { EmitTicketModal } from '@/components/event/individual/EmitTicketModal';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { ScanTicket } from '@/components/event/individual/ScanTicket';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ToggleActivateButton } from '@/components/event/individual/ToggleActivateButton';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

async function EventDetails({ slug }: { slug: string }) {
  const event = await trpc.events.getBySlug(slug);
  const session = await auth();
  const isAdmin = session?.user.role === 'ADMIN';

  if (!event) {
    notFound();
  }

  const tickets = event.ticketGroups
    .filter((tg) => !tg.isOrganizerGroup)
    .flatMap((tg) => tg.emittedTickets);
  const maxAvailable = event.ticketTypes
    .filter((tt) => tt.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim())
    .reduce((acc, tt) => acc + tt.maxAvailable, 0);
  const organizerTickets = event.ticketGroups
    .filter((tg) => tg.isOrganizerGroup)
    .flatMap((tg) => tg.emittedTickets);

  return (
    <div className='flex flex-col items-center mt-4 relative'>
      <div className='absolute top-0 left-0 px-4'>
        <GoBack route='/admin/event' />
      </div>
      <div className='flex flex-col items-center mt-4'>
        <EventBasicInformation event={event} />
        <QuantityTicketsEmitted
          tickets={tickets}
          organizerTickets={organizerTickets}
          maxAvailable={maxAvailable}
        />
      </div>
      <div className='flex justify-between w-full px-4 mt-2'>
        <div className='flex-1 flex justify-center items-center'>
          <div className='md:flex md:gap-x-2 md:items-center grid grid-cols-2 gap-2 md:grid-cols-none'>
            {isAdmin && (
              <div className='md:order-1 order-3'>
                <DeleteEventModal event={event} />
              </div>
            )}
            <div className='md:order-2 order-1'>
              <ScanTicket eventId={event.id} eventSlug={event.slug} />
            </div>
            {(event.inviteCondition === 'TRADITIONAL' ||
              event.inviteCondition === 'SIMPLE') && (
              <div className='md:order-3 order-2'>
                <EmitTicketModal event={event} />
              </div>
            )}
            {isAdmin &&
              (event.inviteCondition === 'TRADITIONAL' ||
                event.inviteCondition === 'SIMPLE') && (
                <div className='md:order-4 order-4'>
                  <ToggleActivateButton event={event} />
                </div>
              )}
          </div>
        </div>
      </div>
      <TicketTableWithTabs
        ticketTypes={event.ticketTypes}
        event={{
          slug: event.slug,
          inviteCondition: event.inviteCondition,
          hasSimpleInvitation: event.hasSimpleInvitation,
        }}
      />
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
