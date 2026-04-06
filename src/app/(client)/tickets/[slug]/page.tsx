'use server';
import { TRPCError } from '@trpc/server';
import { notFound, redirect } from 'next/navigation';

import TicketsClient from '@/app/(client)/tickets/[slug]/client';
import { trpc } from '@/server/trpc/server';

interface PaymentPageProps {
  params: Promise<{
    slug: string;
  }>;
}
export default async function TicketsPage({ params }: PaymentPageProps) {
  const { slug } = await params;

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

  return (
    <TicketsClient ticketGroupId={data.ticketGroupId} tickets={data.tickets} />
  );
}
