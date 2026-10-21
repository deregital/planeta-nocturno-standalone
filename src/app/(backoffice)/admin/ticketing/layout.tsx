import { requirePagePermission } from '@/server/rbac/guards';

export default async function TicketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePagePermission('scanner:use');
  return children;
}
