import { trpc } from '@/server/trpc/server';
import { InvitationTicketTable } from '@/components/organization/event/InvitationTicketTable';

export async function InvitationTicketTableWrapper({
  eventSlug,
  eventId,
  eventName,
}: {
  eventId: string;
  eventSlug: string;
  eventName: string;
}) {
  const codes = await trpc.organizer.getMyCodesNotUsed(eventId);
  return (
    <InvitationTicketTable
      eventId={eventId}
      eventSlug={eventSlug}
      eventName={eventName}
      codes={codes}
    />
  );
}
