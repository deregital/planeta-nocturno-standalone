import { trpc } from '@/server/trpc/server';
import Client from '@/app/admin/categories/client';

export default async function Categories() {
  const data = await trpc.eventCategory.getAll();

  return <Client categories={data} />;
}
