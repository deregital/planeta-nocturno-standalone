import { notFound, redirect } from 'next/navigation';

import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { trpc } from '@/server/trpc/server';
import { auth } from '@/server/auth';
import GoBack from '@/components/common/GoBack';

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  const iAmOrganizer = event?.eventXorganizers.some(
    (eo) => eo.user.id === session?.user.id,
  );

  if (!iAmOrganizer) {
    redirect('/organization');
  }

  return (
    <div className='w-full mt-4'>
      <GoBack route='/organization' />
      <EventBasicInformation event={event} />
    </div>
  );
}
