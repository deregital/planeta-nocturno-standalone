import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import GoBack from '@/components/common/GoBack';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { CopyUrl } from '@/components/organization/event/CopyUrl';
import { InvitationTicketTableWrapper } from '@/components/organization/event/InvitationTicketTableWrapper';
import { TraditionalTicketTableWrapper } from '@/components/organization/event/TraditionalTicketTableWrapper';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';
import { ORGANIZER_CODE_QUERY_PARAM } from '@/server/utils/constants';

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const event = await trpc.events.getBySlug(slug);
  const myCode = await trpc.organizer.getMyCode();

  if (!event) {
    notFound();
  }

  const iAmOrganizer = event?.eventXorganizers.some(
    (eo) => eo.user.id === session?.user.id,
  );

  if (!iAmOrganizer) {
    redirect('/organization');
  }

  const headersList = await headers();
  const host = headersList.get('x-forwarded-host');
  const proto = headersList.get('x-forwarded-proto');

  // Construct the origin
  const origin = proto && host ? `${proto}://${host}` : '';

  return (
    <div className='w-full py-4'>
      <GoBack route='/organization' className='ml-4' />
      <EventBasicInformation event={event} />
      {event.inviteCondition === 'TRADITIONAL' && (
        <div className='w-full text-center'>
          <CopyUrl
            url={`${origin}/event/${event.slug}?${ORGANIZER_CODE_QUERY_PARAM}=${myCode}`}
          />
        </div>
      )}
      <h2 className='text-3xl font-bold px-4 text-accent my-4'>
        Lista de ventas
      </h2>

      <Suspense
        fallback={<div className='text-center p-8'>Cargando ventas...</div>}
      >
        {session?.user.role === 'CHIEF_ORGANIZER' ? (
          <TicketTableWithTabs ticketTypes={event.ticketTypes} />
        ) : (
          <TraditionalTicketTableWrapper eventId={event.id} />
        )}
      </Suspense>

      {event.inviteCondition === 'INVITATION' && (
        <>
          <h2 className='text-3xl font-bold px-4 text-accent mb-4 mt-8'>
            Códigos de invitación
          </h2>
          <Suspense
            fallback={
              <div className='text-center p-8'>Cargando códigos...</div>
            }
          >
            <InvitationTicketTableWrapper
              eventId={event.id}
              eventSlug={event.slug}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
