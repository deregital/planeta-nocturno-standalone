import { redirect } from 'next/navigation';

import ScanMultiClient from '@/app/(backoffice)/admin/ticketing/scan/client';

export default async function TicketingScanPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;

  const eventIds = ids ? ids.split(',').filter(Boolean) : [];

  if (eventIds.length === 0) {
    redirect('/admin/ticketing');
  }

  return <ScanMultiClient eventIds={eventIds} />;
}
