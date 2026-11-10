import 'server-only';

import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import { eventXorganizer, eventXUser } from '@/drizzle/schema';
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
 * Misma regla que `canScanEvent` (`@/server/rbac/event-access`) y que la lista
 * de eventos para escanear: con "Ver todos los eventos" se accede a
 * cualquiera; si no, a los asignados como personal o como organizador.
 */
export async function assertEventsAccess(
  ctx: AccessContext,
  eventIds: readonly string[],
) {
  if (ctx.can('events:read_all')) return;

  const uniqueIds = [...new Set(eventIds)];
  if (uniqueIds.length === 0) return;

  const [asStaff, asOrganizer] = await Promise.all([
    ctx.db
      .select({ eventId: eventXUser.a })
      .from(eventXUser)
      .where(
        and(
          eq(eventXUser.b, ctx.session.user.id),
          inArray(eventXUser.a, uniqueIds),
        ),
      ),
    ctx.db
      .select({ eventId: eventXorganizer.eventId })
      .from(eventXorganizer)
      .where(
        and(
          eq(eventXorganizer.organizerId, ctx.session.user.id),
          inArray(eventXorganizer.eventId, uniqueIds),
        ),
      ),
  ]);

  const allowed = new Set(
    [...asStaff, ...asOrganizer].map((row) => row.eventId),
  );
  const denied = uniqueIds.filter((id) => !allowed.has(id));

  if (denied.length > 0) {
    // Regla nueva para el escaneo: deja rastro para ver a quién le pega.
    logger.warn('Scanner access denied: user not assigned to the event', {
      operation: 'scanner_access',
      code: 'SCANNER_EVENT_NOT_ASSIGNED',
      userId: ctx.session.user.id,
      eventIds: denied.join(','),
    });
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: SCANNER_ACCESS_DENIED_MESSAGE,
    });
  }
}
