import { trpc } from '@/server/trpc/server';
import { TraditionalTicketTable } from '@/components/organization/event/TraditionalTicketTable';

export async function TraditionalTicketTableWrapper({
  eventId,
}: {
  eventId: string;
}) {
  const tickets = await trpc.organizer.getMyTicketsSold(eventId);
  return <TraditionalTicketTable tickets={tickets} />;
}
