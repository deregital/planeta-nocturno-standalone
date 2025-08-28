import { notFound } from 'next/navigation';

import Client from '@/app/admin/database/[dni]/client';
import { trpc } from '@/server/trpc/server';

export default async function Page({
  params,
}: {
  params: Promise<{ dni: string }>;
}) {
  const { dni } = await params;

  const data = await trpc.emittedTickets.getUniqueBuyer(dni);

  if (!data) {
    return notFound();
  }

  return <Client data={data} />;
}
