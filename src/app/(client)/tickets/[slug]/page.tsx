'use server';
import { TRPCError } from '@trpc/server';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import TicketsClient from '@/app/(client)/tickets/[slug]/client';
import TicketsWaitingClient from '@/app/(client)/tickets/[slug]/waiting';
import { trpc } from '@/server/trpc/server';

interface PaymentPageProps {
  params: Promise<{
    slug: string;
  }>;
}
export default async function TicketsPage({ params }: PaymentPageProps) {
  const { slug } = await params;

  const { status } = await trpc.ticketGroup.getStatus(slug).catch((e) => {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
      notFound();
    }
    redirect('/tickets/error');
  });

  if (status === 'BOOKED') {
    return <TicketsWaitingClient ticketGroupId={slug} />;
  }

  const data = await trpc.ticketGroup
    .getTicketsForDownloadPage(slug)
    .catch((e) => {
      if (e instanceof TRPCError) {
        if (e.code === 'NOT_FOUND' || e.code === 'BAD_REQUEST') {
          notFound();
        }
      }
      redirect('/tickets/error');
    });

  (await cookies()).delete('carrito');

  return (
    <TicketsClient ticketGroupId={data.ticketGroupId} tickets={data.tickets} />
  );
}
