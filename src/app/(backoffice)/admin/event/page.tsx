import Client from '@/app/(backoffice)/admin/event/client';
import { hasPermission } from '@/lib/rbac/permissions';
import { requirePagePermission } from '@/server/rbac/guards';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const access = await requirePagePermission('events:read');

  let events:
    | RouterOutputs['events']['getAll']
    | RouterOutputs['events']['getAuthorized'];

  if (hasPermission(access.permissions, 'events:read_all')) {
    events = await trpc.events.getAll();
  } else {
    events = await trpc.events.getAuthorized(access.userId);
  }

  return <Client events={events} />;
}
