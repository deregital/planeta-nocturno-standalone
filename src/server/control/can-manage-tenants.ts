import 'server-only';

import type { Session } from 'next-auth';

import { eq } from 'drizzle-orm';
import { type Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getControlDb } from '@/db/control/client';
import {
  controlAdmins,
  controlRolePermissions,
  controlRoles,
} from '@/db/control/schema';
import {
  CONTROL_PERMISSIONS,
  type ControlPermission,
  parseControlPermissions,
  SUPER_ADMIN_ROLE_NAME,
} from '@/lib/control/permissions';
import { auth } from '@/server/auth';
import { isControlRequest } from '@/server/control/is-control-request';

export async function canManageTenants() {
  return Boolean(await getControlAdminSession());
}

export async function getControlAdminSession() {
  const session = await auth();
  if (session?.user.role !== 'CONTROL_ADMIN') return null;
  if (!isControlRequest(new Headers(await headers()))) return null;
  return session;
}

export async function getControlAdminPermissions(
  adminId?: string,
): Promise<ControlPermission[] | null> {
  const session = await getControlAdminSession();
  if (!session) return null;

  const id = adminId ?? session.user.id;
  const [admin] = await getControlDb()
    .select({
      id: controlAdmins.id,
      roleName: controlRoles.name,
    })
    .from(controlAdmins)
    .innerJoin(controlRoles, eq(controlAdmins.roleId, controlRoles.id))
    .where(eq(controlAdmins.id, id))
    .limit(1);

  if (!admin) return [];

  if (admin.roleName === SUPER_ADMIN_ROLE_NAME) {
    return [...CONTROL_PERMISSIONS];
  }

  const rows = await getControlDb()
    .select({ permission: controlRolePermissions.permission })
    .from(controlAdmins)
    .innerJoin(
      controlRolePermissions,
      eq(controlAdmins.roleId, controlRolePermissions.roleId),
    )
    .where(eq(controlAdmins.id, id));

  return parseControlPermissions(rows.map((row) => row.permission));
}

export async function hasPermission(
  permission: ControlPermission,
): Promise<boolean> {
  const permissions = await getControlAdminPermissions();
  return permissions?.includes(permission) ?? false;
}

export async function requirePermission(
  permission: ControlPermission,
): Promise<
  | { ok: true; session: Session; permissions: ControlPermission[] }
  | { ok: false }
> {
  const session = await getControlAdminSession();
  if (!session) return { ok: false };

  const permissions = await getControlAdminPermissions(session.user.id);
  if (!permissions?.includes(permission)) return { ok: false };

  return { ok: true, session, permissions };
}

export async function requireAnyPermission(
  requiredPermissions: readonly ControlPermission[],
): Promise<
  | { ok: true; session: Session; permissions: ControlPermission[] }
  | { ok: false }
> {
  const session = await getControlAdminSession();
  if (!session) return { ok: false };

  const permissions = await getControlAdminPermissions(session.user.id);
  if (
    !permissions ||
    !requiredPermissions.some((permission) => permissions.includes(permission))
  ) {
    return { ok: false };
  }

  return { ok: true, session, permissions };
}

export async function requirePermissionOrRedirect(
  permission: ControlPermission,
  fallbackPath: Route = '/',
) {
  const result = await requirePermission(permission);
  if (!result.ok) redirect(fallbackPath);
  return result;
}

export async function requireAnyPermissionOrRedirect(
  permissions: readonly ControlPermission[],
  fallbackPath: Route = '/',
) {
  const result = await requireAnyPermission(permissions);
  if (!result.ok) redirect(fallbackPath);
  return result;
}
