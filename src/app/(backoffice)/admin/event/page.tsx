import { redirect } from 'next/navigation';

import Client from '@/app/(backoffice)/admin/event/client';
import { auth } from '@/server/auth';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  let events: RouterOutputs['events']['getAll'] = {
    pastEvents: {
      folders: [],
      withoutFolders: [],
    },
    upcomingEvents: {
      folders: [],
      withoutFolders: [],
    },
  };

  if (session.user.role === 'ADMIN') {
    events = await trpc.events.getAll();
  } else {
    events = await trpc.events.getAuthorized(session.user.id);
  }

  return <Client events={events} />;
}
