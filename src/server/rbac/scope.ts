import 'server-only';

import type { TenantPermission } from '@/lib/rbac/permissions';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { user } from '@/drizzle/schema';
import { isHiddenUser } from '@/server/rbac/access';

type ScopeContext = {
  db: Db;
  session: { user: { id: string } };
  can: (permission: TenantPermission) => boolean;
};

/**
 * Sin "Ver todos los organizadores" solo se accede a uno mismo y a los
 * organizadores del propio equipo.
 */
export async function assertCanAccessOrganizer(
  ctx: ScopeContext,
  organizerId: string,
) {
  if (organizerId === ctx.session.user.id) return;

  const target = await ctx.db.query.user.findFirst({
    where: eq(user.id, organizerId),
    columns: { chiefOrganizerId: true, accessRoleId: true },
  });

  if (!target || isHiddenUser(target)) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Usuario no encontrado',
    });
  }

  if (ctx.can('organizers:read_all')) return;

  if (target.chiefOrganizerId !== ctx.session.user.id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tenés acceso a este organizador',
    });
  }
}
