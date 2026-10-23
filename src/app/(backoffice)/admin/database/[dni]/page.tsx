import { notFound } from 'next/navigation';

import Client from '@/app/(backoffice)/admin/database/[dni]/client';
import { hasPermission } from '@/lib/rbac/permissions';
import { requirePagePermission } from '@/server/rbac/guards';
import { emittedTicketSchema } from '@/server/schemas/emitted-tickets';
import { trpc } from '@/server/trpc/server';

export default async function Page({
  params,
}: {
  params: Promise<{ dni: string }>;
}) {
  const access = await requirePagePermission('database:read');
  const { dni } = await params;

  const res = emittedTicketSchema.shape.dni.safeParse(dni);
  if (!res.success) {
    return notFound();
  }

  const canSeeHistory = hasPermission(
    access.permissions,
    'database:emission_history',
  );

  const [data, emissionHistory] = await Promise.all([
    trpc.emittedTickets.getUniqueBuyer(dni),
    canSeeHistory
      ? trpc.emittedTickets.getEmissionHistoryByDni(dni)
      : Promise.resolve(null),
  ]);

  if (!data) {
    return notFound();
  }

  return <Client data={data} emissionHistory={emissionHistory} />;
}
