import { trpc } from '@/server/trpc/server';
import { InvitationTicketTable } from '@/components/organization/event/InvitationTicketTable';

export async function InvitationTicketTableWrapper({
  eventSlug,
  eventId,
}: {
  eventId: string;
  eventSlug: string;
}) {
  const codes = await trpc.organizer.getMyCodesNotUsed(eventId);
  return <InvitationTicketTable eventSlug={eventSlug} codes={codes} />;
}
