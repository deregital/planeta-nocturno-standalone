import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';
import Client from '@/app/(backoffice)/admin/event/client';

export default async function Page() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  let events: RouterOutputs['events']['getAll'] = {
    pastEvents: [],
    upcomingEvents: [],
  };

  if (session.user.role === 'ADMIN') {
    events = await trpc.events.getAll();
  } else {
    events = await trpc.events.getAuthorized(session.user.id);
  }

  return (
    <div>
      <SessionProvider>
        <Client events={events} />
      </SessionProvider>
    </div>
  );
}
