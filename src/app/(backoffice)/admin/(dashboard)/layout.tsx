import { redirect } from 'next/navigation';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  redirect('/admin/event');
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
