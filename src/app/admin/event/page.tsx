import { trpc } from '@/server/trpc/server';
import Client from './client';

export default async function Page() {
  const events = await trpc.events.getAll();

  return (
    <div>
      <Client events={events} />
    </div>
  );
}
