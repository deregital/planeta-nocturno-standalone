'use server';
import { trpc } from '@/server/trpc/server';
import { notFound, redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import TicketsClient from './client';

interface PaymentPageProps {
  params: Promise<{
    slug: string;
  }>;
}
export default async function TicketsPage({ params }: PaymentPageProps) {
  const { slug } = await params;

  const pdfs = await trpc.ticketGroup
    .generatePdfsByTicketGroupId(slug)
    .catch((e) => {
      if (e instanceof TRPCError) {
        if (e.code === 'NOT_FOUND' || e.code === 'BAD_REQUEST') {
          notFound();
        }
      }
      redirect('/tickets/error');
    });

  return <TicketsClient pdfs={pdfs} />;
}
