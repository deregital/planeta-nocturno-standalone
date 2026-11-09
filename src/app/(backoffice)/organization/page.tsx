import Client from '@/app/(backoffice)/organization/client';
import { isEventPast, isEventUpcoming } from '@/lib/event-dates';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function OrganizationPage() {
  await requirePagePermission('organizer:act');
  const myEvents = await trpc.organizer.getMyEvents();
  // Por fecha: venían en el orden en que se asignó al organizador.
  const byStart = (a: { startingDate: string | null }, b: typeof a) =>
    (a.startingDate ? new Date(a.startingDate).getTime() : Infinity) -
    (b.startingDate ? new Date(b.startingDate).getTime() : Infinity);
  const upcomingEvents = myEvents
    .filter((event) => isEventUpcoming(event.event.endingDate))
    .map((event) => event.event)
    .sort(byStart);
  const pastEvents = myEvents
    .filter((event) => isEventPast(event.event.endingDate))
    .map((event) => event.event)
    .sort((a, b) => byStart(b, a));

  return <Client upcomingEvents={upcomingEvents} pastEvents={pastEvents} />;
}
