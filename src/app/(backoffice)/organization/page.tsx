import Client from '@/app/(backoffice)/organization/client';
import { isEventPast, isEventUpcoming } from '@/lib/event-dates';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function OrganizationPage() {
  await requirePagePermission('organizer:act');
  const myEvents = await trpc.organizer.getMyEvents();
  const upcomingEvents = myEvents
    .filter((event) => isEventUpcoming(event.event.endingDate))
    .map((event) => event.event);
  const pastEvents = myEvents
    .filter((event) => isEventPast(event.event.endingDate))
    .map((event) => event.event);

  return <Client upcomingEvents={upcomingEvents} pastEvents={pastEvents} />;
}
