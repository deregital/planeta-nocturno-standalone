import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import GoBack from '@/components/common/GoBack';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ChiefOrganizerEventView } from '@/components/organization/event/ChiefOrganizerEventView';
import { CopyUrl } from '@/components/organization/event/CopyUrl';
import { InvitationTicketTableWrapper } from '@/components/organization/event/InvitationTicketTableWrapper';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';
import {
  ORGANIZER_CODE_QUERY_PARAM,
  ORGANIZER_TICKET_TYPE_NAME,
} from '@/server/utils/constants';

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

  // TODO: Refactorizar esto con el nuevo TicketType.organizers
  // Obtener los slugs de los ticket types donde el organizador está incluido
  const myTicketTypeSlugs = event.ticketTypes
    .filter((tt) =>
      tt.ticketTypeXOrganizers?.some((tto) => tto.b === session?.user.id),
    )
    .map((tt) => tt.slug);

  // Construir la URL con los ticket types
  const ticketParam =
    myTicketTypeSlugs.length > 0
      ? `&ticket=${myTicketTypeSlugs.join(',')}`
      : '';

  // Para chief organizer: obtener IDs de sus organizadores
  const myOrganizerIds =
    session?.user.role === 'CHIEF_ORGANIZER'
      ? event.eventXorganizers
          .filter((eo) => eo.user.chiefOrganizerId === session?.user.id)
          .map((eo) => eo.user.id)
      : [];

  // Filtrar tickets: chief organizer ve los de sus organizadores, organizador ve solo los suyos
  const myTickets = event.ticketGroups
    .filter((tg) => !tg.isOrganizerGroup)
    .filter((tg) =>
      session?.user.role === 'CHIEF_ORGANIZER'
        ? myOrganizerIds.includes(tg.invitedById ?? '')
        : tg.invitedById === session?.user.id,
    )
    .flatMap((tg) => tg.emittedTickets);

  return (
    <div className='w-full py-4'>
      <GoBack route='/organization' className='ml-4' />
      <div className='flex flex-col items-center my-4'>
        <EventBasicInformation event={event} />
        <QuantityTicketsEmitted tickets={myTickets} />
      </div>
      {event.inviteCondition === 'TRADITIONAL' && (
        <div className='w-full text-center'>
          <CopyUrl
            url={`${origin}/event/${event.slug}?${ORGANIZER_CODE_QUERY_PARAM}=${myCode}${ticketParam}`}
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
          <ChiefOrganizerEventView
            event={event}
            chiefOrganizerId={session.user.id}
          />
        ) : (
          <TicketTableWithTabs
            ticketTypes={event.ticketTypes.filter(
              (tt) => tt.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
            )}
            userId={session?.user.id}
            eventSlug={event.slug}
          />
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
