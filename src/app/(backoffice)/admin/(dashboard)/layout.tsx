import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { getCurrentLandingPath } from '@/server/rbac/guards';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirect(await getCurrentLandingPath());
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
