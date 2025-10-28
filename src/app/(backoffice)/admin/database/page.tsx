import Client from '@/app/(backoffice)/admin/database/client';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const buyers = await trpc.emittedTickets.getAllUniqueBuyer();

  return <Client buyers={buyers} />;
}
