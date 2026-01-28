import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirect('/admin/database');
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
