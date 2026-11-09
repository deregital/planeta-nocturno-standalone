import 'server-only';

import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import { eventXUser } from '@/drizzle/schema';
import { type TenantPermission } from '@/lib/rbac/permissions';
import { logger } from '@/server/observability/logger';

export const SCANNER_ACCESS_DENIED_MESSAGE =
  'No tenés acceso a este evento: pedile a un administrador que te asigne.';

type AccessContext = {
  db: Db;
  can: (permission: TenantPermission) => boolean;
  session: { user: { id: string } };
};

/**
 * Misma regla que `canAccessEvent` y que la lista de eventos para escanear
 * (`events.getAllForTicketing`): con "Ver todos los eventos" se accede a
 * cualquiera; si no, solo a los asignados.
 */
export async function assertEventsAccess(
  ctx: AccessContext,
  eventIds: readonly string[],
) {
  if (ctx.can('events:read_all')) return;

  const uniqueIds = [...new Set(eventIds)];
  if (uniqueIds.length === 0) return;

  const assigned = await ctx.db
    .select({ eventId: eventXUser.a })
    .from(eventXUser)
    .where(
      and(
        eq(eventXUser.b, ctx.session.user.id),
        inArray(eventXUser.a, uniqueIds),
      ),
    );

  if (assigned.length < uniqueIds.length) {
    // Regla nueva para el escaneo: deja rastro para ver a quién le pega.
    const allowed = new Set(assigned.map((row) => row.eventId));
    logger.warn('Scanner access denied: user not assigned to the event', {
      operation: 'scanner_access',
      code: 'SCANNER_EVENT_NOT_ASSIGNED',
      userId: ctx.session.user.id,
      eventIds: uniqueIds.filter((id) => !allowed.has(id)).join(','),
    });
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: SCANNER_ACCESS_DENIED_MESSAGE,
    });
  }
}
