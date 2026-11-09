import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';
import { eq } from 'drizzle-orm';

import GoBack from '@/components/common/GoBack';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { OrganizerDistribution } from '@/components/event/individual/OrganizerDistribution';
import { PrintEventQr } from '@/components/event/individual/PrintEventQr';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { ScanTicket } from '@/components/event/individual/ScanTicket';
import { SurveyAnswersTable } from '@/components/event/individual/SurveyAnswersTable';
import { TicketRaffle } from '@/components/event/individual/TicketRaffle';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ChiefOrganizerEventView } from '@/components/organization/event/ChiefOrganizerEventView';
import { CopyUrl } from '@/components/organization/event/CopyUrl';
import { InvitationTicketTableWrapper } from '@/components/organization/event/InvitationTicketTableWrapper';
import { getChiefDistributableTicketPool } from '@/lib/chief-organizer-event';
import { user } from '@/drizzle/schema';
import { hasPermission, type TenantPermission } from '@/lib/rbac/permissions';
import { auth } from '@/server/auth';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { canScanEvent, requirePagePermission } from '@/server/rbac/guards';
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
  const access = await requirePagePermission('organizer:act');
  const can = (permission: TenantPermission) =>
    hasPermission(access.permissions, permission);
  const isTeamLead = can('organizer:team');
  const { slug } = await params;
  const [session, event, myCode] = await Promise.all([
    auth(),
    trpc.events.getBySlug(slug),
    trpc.organizer.getMyCode(),
  ]);

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

  const organizerEventUrl = `${origin}/event/${event.slug}?${ORGANIZER_CODE_QUERY_PARAM}=${myCode}${ticketParam}`;

  // Quien lidera un equipo ve las ventas de sus organizadores
  const myOrganizerIds = isTeamLead
    ? event.eventXorganizers
        .filter((eo) => eo.user.chiefOrganizerId === session?.user.id)
        .map((eo) => eo.user.id)
    : [];

  // Filtrar tickets: chief organizer ve los de sus organizadores, organizador ve solo los suyos
  const isMyTicketGroup = (tg: (typeof event.ticketGroups)[number]) =>
    isTeamLead
      ? myOrganizerIds.includes(tg.invitedById ?? '')
      : tg.invitedById === session?.user.id;
  const myTickets = event.ticketGroups
    .filter((tg) => !tg.isOrganizerGroup)
    .filter(isMyTicketGroup)
    .flatMap((tg) => tg.emittedTickets);

  // Sorteo y respuestas del formulario: con "Ver todas las ventas" cubren todo
  // el evento; si no, solo las compras que el organizador ya ve en su lista.
  // Mismo alcance que la lista de ventas (emittedTickets.getByEventId): el
  // jefe ve sus propias ventas y las de todo su equipo, esté o no asignado
  // cada organizador a este evento.
  const visibleSellerIds = new Set<string>([access.userId]);
  if (isTeamLead && !can('tickets:read_all')) {
    const { db } = await getCurrentRequestContext();
    const team = await db.query.user.findMany({
      where: eq(user.chiefOrganizerId, access.userId),
      columns: { id: true },
    });
    for (const member of team) visibleSellerIds.add(member.id);
  }
  const visibleTicketGroups = event.ticketGroups
    .filter((tg) => !tg.isOrganizerGroup)
    .filter(
      (tg) =>
        can('tickets:read_all') || visibleSellerIds.has(tg.invitedById ?? ''),
    );
  // Igual que en /admin/event: una compra sin pagar no entra al sorteo, salvo
  // el cobro en el lugar.
  const raffleTickets = visibleTicketGroups
    .filter((tg) => tg.status !== 'BOOKED' || tg.paymentMethod === 'ON_SITE')
    .flatMap((tg) => tg.emittedTickets)
    .map((ticket) => ({
      shortId: ticket.shortId,
      fullName: ticket.fullName,
      mail: ticket.mail,
    }));
  const showRaffle = can('tickets:raffle');
  const showScan = await canScanEvent(access, event.id);
  const answeredQuestionIds = new Set(
    visibleTicketGroups.flatMap((tg) =>
      tg.ticketGroupAnswers.map((a) => a.questionId),
    ),
  );
  const showAnswers =
    can('tickets:answers') &&
    event.eventQuestions.some(
      (eventQuestion) =>
        !eventQuestion.isDeleted || answeredQuestionIds.has(eventQuestion.id),
    );
  const showTraditionalLinks = event.inviteCondition === 'TRADITIONAL';

  const userId = session?.user.id;
  const maxAvailable =
    event.inviteCondition === 'INVITATION' && userId
      ? isTeamLead
        ? getChiefDistributableTicketPool(event, userId)
        : (event.eventXorganizers.find((eo) => eo.user.id === userId)
            ?.ticketAmount ?? 0)
      : undefined;

  return (
    <div className='w-full py-4'>
      <GoBack route='/organization' className='ml-4' />
      <div className='flex flex-col items-center my-4'>
        <EventBasicInformation event={event} />
        <QuantityTicketsEmitted
          tickets={myTickets}
          maxAvailable={maxAvailable}
        />
      </div>
      {(showTraditionalLinks || showScan || showRaffle) && (
        <div className='w-full px-4 text-center'>
          <div className='flex flex-wrap items-center justify-center gap-3'>
            {showScan && (
              <ScanTicket eventId={event.id} eventSlug={event.slug} />
            )}
            {showTraditionalLinks && (
              <>
                <CopyUrl eventName={event.name} url={organizerEventUrl} />
                <PrintEventQr
                  eventName={event.name}
                  url={organizerEventUrl}
                  showLabel={false}
                />
              </>
            )}
            {showRaffle && (
              <TicketRaffle eventId={event.id} tickets={raffleTickets} />
            )}
          </div>
        </div>
      )}
      {isTeamLead &&
        can('organizers:distribute') &&
        event.inviteCondition === 'INVITATION' && (
          <div className='mt-4 flex justify-center px-4'>
            <OrganizerDistribution event={event} />
          </div>
        )}
      <h2 className='text-3xl font-bold px-4 text-accent my-4'>
        Lista de ventas
      </h2>

      <Suspense
        fallback={<div className='text-center p-8'>Cargando ventas...</div>}
      >
        {isTeamLead ? (
          <ChiefOrganizerEventView
            event={event}
            chiefOrganizerId={access.userId}
          />
        ) : (
          <TicketTableWithTabs
            ticketTypes={event.ticketTypes.filter(
              (tt) => tt.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
            )}
            userId={session?.user.id}
            event={{
              slug: event.slug,
              inviteCondition: event.inviteCondition,
              hasSimpleInvitation: event.hasSimpleInvitation,
            }}
          />
        )}
      </Suspense>

      {can('organizer:invitation_codes') &&
        event.inviteCondition === 'INVITATION' && (
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
                eventName={event.name}
              />
            </Suspense>
          </>
        )}

      {showAnswers && (
        <NuqsAdapter>
          <SurveyAnswersTable
            event={{ ...event, ticketGroups: visibleTicketGroups }}
          />
        </NuqsAdapter>
      )}
    </div>
  );
}
