import { requireAccess } from '@/server/rbac/guards';

export default async function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess();
  return children;
}
