import { trpc } from '@/server/trpc/server';
import Client from './client';

export default async function Page() {
  const buyers = await trpc.emittedTickets.getAllUniqueBuyer();

  return <Client buyers={buyers} />;
}
