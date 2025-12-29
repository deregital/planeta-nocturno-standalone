import { redirect } from 'next/navigation';

import Client from '@/app/(backoffice)/organization/organizers/client';
import { auth } from '@/server/auth';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const session = await auth();

  if (session?.user.role !== 'CHIEF_ORGANIZER') {
    redirect('/organization');
  }

  const organizers = await trpc.user.getOrganizersByChiefOrganizer();

  return <Client organizers={organizers} />;
}
