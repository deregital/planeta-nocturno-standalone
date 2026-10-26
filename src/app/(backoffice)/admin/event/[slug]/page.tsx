import { notFound } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';

import GoBack from '@/components/common/GoBack';
import AdminEventDetailSkeleton from '@/components/event/individual/AdminEventDetailSkeleton';
import { AdminInvitationEventView } from '@/components/event/individual/AdminInvitationEventView';
import DeleteEventModal from '@/components/event/individual/DeleteEventModal';
import { EmitTicketModal } from '@/components/event/individual/EmitTicketModal';
import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { OrganizerDistribution } from '@/components/event/individual/OrganizerDistribution';
import { PrintEventQr } from '@/components/event/individual/PrintEventQr';
import { QuantityTicketsEmitted } from '@/components/event/individual/QuantityTicketsEmitted';
import { ScanTicket } from '@/components/event/individual/ScanTicket';
import { SurveyAnswersTable } from '@/components/event/individual/SurveyAnswersTable';
import { TicketGroupsTable } from '@/components/event/individual/TicketGroupsTable';
import { TicketRaffle } from '@/components/event/individual/TicketRaffle';
import { TicketTableWithTabs } from '@/components/event/individual/TicketTableWithTabs';
import { ToggleActivateButton } from '@/components/event/individual/ToggleActivateButton';
import { sumInvitationTicketAmounts } from '@/lib/chief-organizer-event';
import {
  getTotalTicketsWithoutOrganizer,
  mapEventOrganizersToSchema,
} from '@/lib/event-organizers';
import { hasPermission, type TenantPermission } from '@/lib/rbac/permissions';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { canAccessEvent, requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

async function EventDetails({ slug }: { slug: string }) {
  const access = await requirePagePermission('events:read');
  const can = (permission: TenantPermission) =>
    hasPermission(access.permissions, permission);
  const event = await trpc.events.getBySlug(slug);

  if (!event || !(await canAccessEvent(access, event.id))) {
    notFound();
  }

  const tickets = event.ticketGroups
    .filter((tg) => !tg.isOrganizerGroup)
    .flatMap((tg) => tg.emittedTickets);
  const maxAvailable =
    event.inviteCondition === 'INVITATION'
      ? sumInvitationTicketAmounts(
          mapEventOrganizersToSchema(event.eventXorganizers, 'INVITATION'),
        )
      : getTotalTicketsWithoutOrganizer(
          event.ticketTypes.map((tt) => ({
            name: tt.name,
            maxAvailable: tt.maxAvailable,
          })),
        );
  const organizerTickets = event.ticketGroups
    .filter((tg) => tg.isOrganizerGroup)
    .flatMap((tg) => tg.emittedTickets);

  const answeredQuestionIds = new Set(
    event.ticketGroups.flatMap((tg) =>
      tg.ticketGroupAnswers.map((a) => a.questionId),
    ),
  );
  const hasVisibleQuestions = event.eventQuestions.some(
    (eventQuestion) =>
      !eventQuestion.isDeleted || answeredQuestionIds.has(eventQuestion.id),
  );

  const { instance } = await getCurrentRequestContext();
  const origin = instance.publicUrl;

  return (
    <div className='flex flex-col items-center mt-4 relative'>
      <div className='absolute top-0 left-0 px-4'>
        <GoBack route='/admin/event' />
      </div>
      <div className='flex flex-col items-center mt-4'>
        <EventBasicInformation event={event} />
        {can('events:statistics') && (
          <QuantityTicketsEmitted
            tickets={tickets}
            organizerTickets={organizerTickets}
            maxAvailable={maxAvailable}
          />
        )}
      </div>
      <div className='flex justify-between w-full px-4 mt-2'>
        <div className='flex-1 flex justify-center items-center'>
          <div className='md:flex md:gap-x-2 md:items-center grid grid-cols-2 gap-2 md:grid-cols-none'>
            {can('events:delete') && (
              <div className='md:order-1 order-3'>
                <DeleteEventModal event={event} />
              </div>
            )}
            {can('scanner:use') && (
              <div className='md:order-2 order-1'>
                <ScanTicket eventId={event.id} eventSlug={event.slug} />
              </div>
            )}
            {can('tickets:create') &&
              (event.inviteCondition === 'TRADITIONAL' ||
                event.inviteCondition === 'SIMPLE') && (
                <div className='md:order-3 order-2'>
                  <EmitTicketModal event={event} />
                </div>
              )}
            {event.inviteCondition !== 'INVITATION' && (
              <div className='md:order-4 order-4'>
                <PrintEventQr
                  showLabel={false}
                  url={`${origin}/event/${event.slug}`}
                  eventName={event.name}
                />
              </div>
            )}
            {can('tickets:raffle') && (
              <div className='md:order-5 order-7'>
                <TicketRaffle
                  eventId={event.id}
                  tickets={tickets.map((ticket) => ({
                    shortId: ticket.shortId,
                    fullName: ticket.fullName,
                    mail: ticket.mail,
                  }))}
                />
              </div>
            )}
            {can('events:publish') &&
              (event.inviteCondition === 'TRADITIONAL' ||
                event.inviteCondition === 'SIMPLE') && (
                <div className='md:order-6 order-5'>
                  <ToggleActivateButton event={event} />
                </div>
              )}
            {can('events:update') && event.inviteCondition === 'INVITATION' && (
              <div className='md:order-7 order-6'>
                <OrganizerDistribution event={event} />
              </div>
            )}
          </div>
        </div>
      </div>
      {can('tickets:read') && (
        <>
          <div className='w-full px-4'>
            <h2 className='text-3xl font-bold text-accent my-4'>
              Lista de ventas
            </h2>
          </div>
          {event.inviteCondition === 'INVITATION' ? (
            <AdminInvitationEventView event={event} />
          ) : (
            <TicketTableWithTabs
              ticketTypes={event.ticketTypes}
              event={{
                slug: event.slug,
                inviteCondition: event.inviteCondition,
                hasSimpleInvitation: event.hasSimpleInvitation,
                hasQuestions: hasVisibleQuestions,
              }}
            />
          )}
        </>
      )}
      {can('tickets:read_all') && event.inviteCondition !== 'INVITATION' && (
        <TicketGroupsTable eventId={event.id} eventSlug={event.slug} />
      )}
      {can('tickets:answers') && hasVisibleQuestions && (
        <SurveyAnswersTable event={event} />
      )}
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
    <Suspense fallback={<AdminEventDetailSkeleton />}>
      <NuqsAdapter>
        <EventDetails slug={slug} />
      </NuqsAdapter>
    </Suspense>
  );
}
