import Client from '@/app/(backoffice)/organization/client';
import { trpc } from '@/server/trpc/server';

export default async function OrganizationPage() {
  const myEvents = await trpc.organizer.getMyEvents();
  const upcomingEvents = myEvents
    .filter((event) => event.event.endingDate > new Date().toISOString())
    .map((event) => event.event);
  const pastEvents = myEvents
    .filter((event) => event.event.endingDate < new Date().toISOString())
    .map((event) => event.event);

  return <Client upcomingEvents={upcomingEvents} pastEvents={pastEvents} />;
}
