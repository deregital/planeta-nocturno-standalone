'use server';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import TicketsClient from '@/app/(client)/tickets/[slug]/client';
import TicketsPendingClient, {
  type ReturnedPaymentStatus,
} from '@/app/(client)/tickets/[slug]/pending';
import TicketsTaloPending from '@/app/(client)/tickets/[slug]/talo-pending';
import TicketsTransferPending from '@/app/(client)/tickets/[slug]/transfer-pending';
import { TicketAccessVerify } from '@/app/(client)/tickets/[slug]/verify';
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
        // Pago y emitido, pero este navegador todavía no probó el DNI.
        if (e.code === 'UNAUTHORIZED') {
          return 'needs_dni' as const;
        }
      }
      redirect('/tickets/error');
    });

  if (data === 'needs_dni') {
    return <TicketAccessVerify ticketGroupId={slug} />;
  }

  if (!data) {
    const pending = await trpc.ticketGroup.getPendingPaymentInfo(slug);
    if (pending?.transferAccount) {
      return (
        <TicketsTaloPending
          ticketGroupId={slug}
          eventName={pending.eventName}
          eventSlug={pending.eventSlug}
          contactEmail={pending.contactEmail}
          account={pending.transferAccount}
          otherPaymentMethods={pending.otherPaymentMethods}
        />
      );
    }
    const transfer = await trpc.ticketGroup.getTransferInstructions(slug);
    if (transfer?.transferAlias) {
      return (
        <TicketsTransferPending
          ticketGroupId={slug}
          otherPaymentMethods={pending?.otherPaymentMethods}
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
        // Esta pantalla reintenta Mercado Pago; Talo tiene la suya.
        canRetryPayment={
          pending?.canRetryPayment && pending.paymentMethod === 'MERCADO_PAGO'
        }
        otherPaymentMethods={pending?.otherPaymentMethods}
      />
    );
  }

  return <TicketsClient data={data} />;
}
