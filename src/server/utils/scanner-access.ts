import 'server-only';

import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import { eventXUser } from '@/drizzle/schema';
import { type TenantPermission } from '@/lib/rbac/permissions';

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
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tenés acceso a este evento',
    });
  }
}
