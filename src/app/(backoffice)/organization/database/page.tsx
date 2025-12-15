import { redirect } from 'next/navigation';

import Client from '@/app/(backoffice)/organization/database/client';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }
  const buyers = await trpc.emittedTickets.getAllUniqueBuyerByOrganizer(
    session.user.id,
  );

  return <Client buyers={buyers} />;
}
