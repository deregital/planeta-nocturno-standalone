'use server';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import TicketsClient from '@/app/(client)/tickets/[slug]/client';
import TicketsPendingClient from '@/app/(client)/tickets/[slug]/pending';
import TicketsTransferPending from '@/app/(client)/tickets/[slug]/transfer-pending';
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
        if (e.code === 'CONFLICT') {
          return null;
        }
      }
      redirect('/tickets/error');
    });

  if (!data) {
    const transfer = await trpc.ticketGroup.getTransferInstructions(slug);
    if (transfer?.transferAlias) {
      return (
        <TicketsTransferPending
          eventName={transfer.eventName}
          buyerName={transfer.buyerName}
          totalAmount={transfer.totalAmount}
          transferAlias={transfer.transferAlias}
          contactEmail={transfer.contactEmail}
        />
      );
    }

    const cookieStore = await cookies();
    const paymentUrl = cookieStore.get('pendingPaymentUrl')?.value;
    return (
      <TicketsPendingClient ticketGroupId={slug} paymentUrl={paymentUrl} />
    );
  }

  return (
    <TicketsClient ticketGroupId={data.ticketGroupId} tickets={data.tickets} />
  );
}
