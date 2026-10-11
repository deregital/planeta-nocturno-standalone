import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';
import Client from '@/app/(backoffice)/admin/locations/client';

export default async function Locations() {
  await requirePagePermission('locations:read');
  const data = await trpc.location.getAll();

  return <Client locations={data} />;
}
