'use server';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import TicketsClient from '@/app/(client)/tickets/[slug]/client';
import TicketsPendingClient, {
  type ReturnedPaymentStatus,
} from '@/app/(client)/tickets/[slug]/pending';
import TicketsTransferPending from '@/app/(client)/tickets/[slug]/transfer-pending';
import { trpc } from '@/server/trpc/server';

interface PaymentPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const RETURNED_PAYMENT_STATUSES = [
  'approved',
  'pending',
  'in_process',
  'rejected',
  'null',
] as const;

export default async function TicketsPage({
  params,
  searchParams,
}: PaymentPageProps) {
  const { slug } = await params;
  const { collection_status: collectionStatus } = await searchParams;

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
    const pending = await trpc.ticketGroup.getPendingPaymentInfo(slug);
    const paymentStatus = RETURNED_PAYMENT_STATUSES.find(
      (status) => status === collectionStatus,
    ) as ReturnedPaymentStatus;
    return (
      <TicketsPendingClient
        ticketGroupId={slug}
        paymentUrl={paymentUrl}
        paymentStatus={paymentStatus}
        eventSlug={pending?.eventSlug}
        holdExpiresAt={pending?.holdExpiresAt}
        canRetryPayment={pending?.canRetryPayment}
      />
    );
  }

  return (
    <TicketsClient ticketGroupId={data.ticketGroupId} tickets={data.tickets} />
  );
}
