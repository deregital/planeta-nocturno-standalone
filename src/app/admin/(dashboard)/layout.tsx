import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NuqsAdapter>{children}</NuqsAdapter>;
}
