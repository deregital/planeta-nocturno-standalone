import 'server-only';

import { and, eq } from 'drizzle-orm';
import { type Route } from 'next';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { eventXUser } from '@/drizzle/schema';
import { getLandingPath, NO_ACCESS_PATH } from '@/lib/rbac/navigation';
import {
  hasAnyPermission,
  hasPermission,
  type TenantPermission,
} from '@/lib/rbac/permissions';
import { auth } from '@/server/auth';
import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
import { loadUserAccess, type UserAccess } from '@/server/rbac/access';

/** Acceso del usuario actual, leído de la base una vez por request. */
export const getCurrentAccess = cache(async (): Promise<UserAccess | null> => {
  const session = await auth();
  if (!session || session.user.role === 'CONTROL_ADMIN') return null;

  const { db } = await getCurrentRequestContext();
  return loadUserAccess(db, session.user.id);
});

export async function requireAccess(): Promise<UserAccess> {
  const access = await getCurrentAccess();
  if (access) return access;

  const session = await auth();
  redirect(session ? NO_ACCESS_PATH : ('/login' as Route));
}

/**
 * Exige permisos para renderizar una página. Si faltan, redirige a la
 * primera sección permitida del usuario (o a la página sin acceso).
 */
export async function requirePagePermission(
  required: TenantPermission | readonly TenantPermission[],
  { mode = 'all' }: { mode?: 'all' | 'any' } = {},
): Promise<UserAccess> {
  const access = await requireAccess();
  const permissions: readonly TenantPermission[] =
    typeof required === 'string' ? [required] : required;

  const allowed =
    mode === 'any'
      ? hasAnyPermission(access.permissions, permissions)
      : permissions.every((permission) =>
          hasPermission(access.permissions, permission),
        );

  if (!allowed) redirect(getLandingPath(access.permissions));
  return access;
}

/** Sin "Ver todos los eventos" solo se accede a los eventos asignados. */
export async function canAccessEvent(access: UserAccess, eventId: string) {
  if (hasPermission(access.permissions, 'events:read_all')) return true;

  const { db } = await getCurrentRequestContext();
  const assignment = await db.query.eventXUser.findFirst({
    where: and(eq(eventXUser.a, eventId), eq(eventXUser.b, access.userId)),
    columns: { a: true },
  });
  return !!assignment;
}

export async function getCurrentLandingPath(): Promise<Route> {
  const access = await requireAccess();
  return getLandingPath(access.permissions);
}
