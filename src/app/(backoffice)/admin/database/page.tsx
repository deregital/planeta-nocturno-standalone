import Client from '@/app/(backoffice)/admin/database/client';
import { hasPermission } from '@/lib/rbac/permissions';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const access = await requirePagePermission('database:read');

  const buyers = hasPermission(access.permissions, 'database:read_all')
    ? await trpc.emittedTickets.getAllUniqueBuyer()
    : await trpc.emittedTickets.getAllUniqueBuyerByOrganizer(access.userId);

  return <Client buyers={buyers} />;
}
