import Client from '@/app/(backoffice)/admin/roles/client';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

export default async function RolesPage() {
  await requirePagePermission('roles:read');
  const roles = await trpc.accessRole.list();

  return <Client roles={roles} />;
}
