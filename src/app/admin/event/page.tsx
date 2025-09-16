import { SessionProvider } from 'next-auth/react';

import Client from '@/app/admin/event/client';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const session = await auth();

  let events = [];

  if (session?.user.role === 'ADMIN') {
    events = await trpc.events.getAll();
  } else {
    events = await trpc.events.getAuthorized(session?.user.id as string);
  }

  return (
    <div>
      <SessionProvider>
        <Client events={events} />
      </SessionProvider>
    </div>
  );
}
