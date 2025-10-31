import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';

import { auth } from '@/server/auth';

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  if (session.user.role !== 'ORGANIZER') {
    redirect('/admin');
  }

  return <SessionProvider>{children}</SessionProvider>;
}
