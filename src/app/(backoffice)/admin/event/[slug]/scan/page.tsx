import { notFound } from 'next/navigation';

import { canScanEvent, requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';
import ScanClient from '@/app/(backoffice)/admin/event/[slug]/scan/client';

export default async function ScanTicketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const access = await requirePagePermission('scanner:use');
  const { slug } = await params;
  // No getPublicBySlug: ésa no devuelve eventos bloqueados y la puerta
  // tiene que poder escanear igual.
  const event = await trpc.events.getForScanBySlug(slug);

  // Personal asignado u organizador asignado: el botón está en las dos
  // páginas del evento (/admin/event y /organization/event).
  if (!event || !(await canScanEvent(access, event.id))) {
    notFound();
  }

  return <ScanClient event={event} />;
}
