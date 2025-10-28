import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';

import { EventBasicInformation } from '@/components/event/individual/EventBasicInformation';
import { trpc } from '@/server/trpc/server';
import { auth } from '@/server/auth';
import GoBack from '@/components/common/GoBack';
import { TraditionalTicketTableWrapper } from '@/components/organization/event/TraditionalTicketTableWrapper';

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
    <div className='w-full py-4'>
      <GoBack route='/organization' />
      <EventBasicInformation event={event} />
      {event.inviteCondition === 'TRADITIONAL' ? (
        <>
          <h1 className='text-3xl font-bold px-4 text-accent mb-6'>
            Lista de ventas
          </h1>

          <Suspense
            fallback={<div className='text-center p-8'>Cargando ventas...</div>}
          >
            <TraditionalTicketTableWrapper eventId={event.id} />
          </Suspense>
        </>
      ) : (
        <></>
      )}
    </div>
  );
}
