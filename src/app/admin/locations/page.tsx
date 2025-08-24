import { trpc } from '@/server/trpc/server';
import Client from './client';

export default async function Locations() {
  const data = await trpc.location.getAll();

  return <Client locations={data} />;
}
