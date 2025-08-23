import { redirect } from 'next/navigation';

import { auth } from '@/server/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  return <div>{children}</div>;
}
