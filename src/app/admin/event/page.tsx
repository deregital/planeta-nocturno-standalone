import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import Client from '@/app/admin/event/client';
import { auth } from '@/server/auth';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';

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
