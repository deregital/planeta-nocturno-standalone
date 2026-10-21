import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';
import Client from '@/app/(backoffice)/admin/categories/client';

export default async function Categories() {
  await requirePagePermission('categories:read');
  const data = await trpc.eventCategory.getAll();

  return <Client categories={data} />;
}
