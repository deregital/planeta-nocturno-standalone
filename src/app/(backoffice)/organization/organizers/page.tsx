import { redirect } from 'next/navigation';

import Client from '@/app/(backoffice)/organization/organizers/client';
import { auth } from '@/server/auth';

export default async function Page() {
  const session = await auth();

  if (session?.user.role !== 'CHIEF_ORGANIZER') {
    redirect('/organization');
  }

  return <Client chiefOrganizerId={session.user.id} />;
}
