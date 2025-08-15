import { trpc } from '@/server/trpc/server';
import Client from './client';

export default async function Locations() {
  const data = await trpc.location.getAll();

  return (
    <div className='px-8 py-8 h-full'>
      <Client locations={data} />
    </div>
  );
}
