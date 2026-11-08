import type { UserAccess } from '@/server/rbac/access';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { event, ticketGroup } from '@/drizzle/schema';
import { hasAnyPermission } from '@/lib/rbac/permissions';

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Bloquear un evento (isBlocked) es distinto de ocultarlo (isActive = false):
 * oculto sólo sale del listado y se sigue entrando por link (borradores,
 * eventos de invitación); bloqueado no lo ve nadie del público, ni por link ni
 * por invitación. No toca las entradas ya emitidas, el scanner ni los pagos
 * que ya están en curso.
 */
export const EVENT_BLOCKED_MESSAGE = 'Este evento no está disponible';

/** El staff sigue viendo un evento bloqueado (vista previa y scanner). */
export function canSeeBlockedEvents(access: UserAccess | null) {
  return (
    !!access &&
    hasAnyPermission(access.permissions, ['events:read', 'scanner:use'])
  );
}

function eventBlockedError() {
  return new TRPCError({ code: 'BAD_REQUEST', message: EVENT_BLOCKED_MESSAGE });
}

export async function assertEventNotBlocked(db: Executor, eventId: string) {
  const [row] = await db
    .select({ isBlocked: event.isBlocked })
    .from(event)
    .where(eq(event.id, eventId));
  if (row?.isBlocked) throw eventBlockedError();
}

export async function assertTicketGroupEventNotBlocked(
  db: Executor,
  ticketGroupId: string,
) {
  const [row] = await db
    .select({ isBlocked: event.isBlocked })
    .from(ticketGroup)
    .innerJoin(event, eq(event.id, ticketGroup.eventId))
    .where(eq(ticketGroup.id, ticketGroupId));
  if (row?.isBlocked) throw eventBlockedError();
}
