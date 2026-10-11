import { notFound } from 'next/navigation';

import { canAccessEvent, requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';
import ScanClient from '@/app/(backoffice)/admin/event/[slug]/scan/client';

export default async function ScanTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const access = await requirePagePermission('scanner:use');
  const { slug } = await params;
  const event = await trpc.events.getBySlug(slug);

  if (!event || !(await canAccessEvent(access, event.id))) {
    notFound();
  }

  return <ScanClient event={event} />;
}
