import { requireAccess } from '@/server/rbac/guards';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess();
  return <div>{children}</div>;
}
