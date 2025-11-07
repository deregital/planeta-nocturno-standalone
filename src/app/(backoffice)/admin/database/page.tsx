import { SessionProvider } from 'next-auth/react';

import Client from '@/app/(backoffice)/admin/database/client';
import { trpc } from '@/server/trpc/server';

export default async function Page() {
  const buyers = await trpc.emittedTickets.getAllUniqueBuyer();

  return (
    <SessionProvider>
      <Client buyers={buyers} />
    </SessionProvider>
  );
}
