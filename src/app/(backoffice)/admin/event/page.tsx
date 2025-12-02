import { redirect } from 'next/navigation';

import Client from '@/app/(backoffice)/admin/event/client';
import { auth } from '@/server/auth';

export default async function Page() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  return <Client session={session} />;
}
