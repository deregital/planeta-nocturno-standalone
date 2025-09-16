import { SessionProvider } from 'next-auth/react';
import { redirect } from 'next/navigation';

import Client from '@/app/admin/event/client';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';
import { type RouterOutputs } from '@/server/routers/app';

export default async function Page() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  let events: RouterOutputs['events']['getAll'] = [];

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
