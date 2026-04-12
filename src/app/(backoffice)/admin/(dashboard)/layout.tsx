import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { auth } from '@/server/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.role === 'CONTROL_TICKETING') {
    redirect('/admin/ticketing');
  }
  redirect('/admin/event');
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
