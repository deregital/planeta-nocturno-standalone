import { notFound } from 'next/navigation';

import { trpc } from '@/server/trpc/server';
import ScanClient from '@/app/admin/event/[slug]/scan/client';

export default async function ScanTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    notFound();
  }

  return <ScanClient event={event} />;
}
