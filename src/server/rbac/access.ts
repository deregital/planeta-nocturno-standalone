import 'server-only';

import type { TenantRole } from '@/lib/auth/roles';

import { eq, ne } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import {
  accessRole as accessRoleTable,
  accessRolePermission,
  user as userTable,
} from '@/drizzle/schema';
import {
  ALL_ACCESS_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  isHiddenPermission,
  LOCKED_SYSTEM_ROLE,
  normalizePermissions,
  SUPERADMIN_ACCESS_ROLE_ID,
  SYSTEM_ROLE_PERMISSIONS,
  type TenantPermission,
} from '@/lib/rbac/permissions';

/** Los superadministradores no figuran en las listas ni en el detalle de otros usuarios. */
export function isHiddenUser(target: { accessRoleId: string | null }) {
  return target.accessRoleId === SUPERADMIN_ACCESS_ROLE_ID;
}

export const visibleUserCondition = ne(
  userTable.accessRoleId,
  SUPERADMIN_ACCESS_ROLE_ID,
);

export type UserAccess = {
  userId: string;
  accessRole: {
    id: string;
    name: string;
    isSystem: boolean;
  } | null;
  permissions: TenantPermission[];
};

export async function loadUserAccess(
  db: Db,
  userId: string,
): Promise<UserAccess | null> {
  const row = await db.query.user.findFirst({
    where: eq(userTable.id, userId),
    columns: { id: true },
    with: {
      accessRole: {
        columns: { id: true, name: true, isSystem: true, baseRole: true },
        with: {
          accessRolePermissions: { columns: { permission: true } },
        },
      },
    },
  });

  if (!row) return null;

  const role = row.accessRole;
  if (!role) return { userId, accessRole: null, permissions: [] };

  return {
    userId,
    accessRole: { id: role.id, name: role.name, isSystem: role.isSystem },
    permissions: resolveRolePermissions(
      role,
      role.accessRolePermissions.map((item) => item.permission),
    ),
  };
}

export function isLockedRole(role: {
  baseRole: TenantRole;
  isSystem: boolean;
}) {
  return role.isSystem && role.baseRole === LOCKED_SYSTEM_ROLE;
}

export function resolveRolePermissions(
  role: { baseRole: TenantRole; isSystem: boolean },
  storedPermissions: Iterable<string>,
): TenantPermission[] {
  const stored = normalizePermissions(storedPermissions);
  if (isLockedRole(role)) {
    const base = stored.includes('system:superadmin')
      ? ALL_ACCESS_PERMISSIONS
      : SYSTEM_ROLE_PERMISSIONS.ADMIN;
    return normalizePermissions([...base, ...stored]);
  }
  return stored;
}

export async function loadRolesWithPermissions(db: Db) {
  const roles = await db.query.accessRole.findMany({
    with: { accessRolePermissions: { columns: { permission: true } } },
  });

  return roles.map((role) => {
    const permissions = resolveRolePermissions(
      role,
      role.accessRolePermissions.map((item) => item.permission),
    );
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      baseRole: role.baseRole,
      isSystem: role.isSystem,
      isLocked: isLockedRole(role),
      isHidden: permissions.some(isHiddenPermission),
      permissions,
    };
  });
}

/** Roles que incluyen el permiso: sirve para filtrar usuarios por capacidad. */
export async function getRoleIdsWithPermission(
  db: Db,
  permission: TenantPermission,
) {
  const roles = await loadRolesWithPermissions(db);
  return roles
    .filter((role) => role.permissions.includes(permission))
    .map((role) => role.id);
}

export async function loadRolePermissions(db: Db, roleId: string) {
  const role = await db.query.accessRole.findFirst({
    where: eq(accessRoleTable.id, roleId),
    columns: { id: true, baseRole: true, isSystem: true },
  });
  if (!role) return null;

  const rows = await db
    .select({ permission: accessRolePermission.permission })
    .from(accessRolePermission)
    .where(eq(accessRolePermission.roleId, roleId));

  return {
    ...role,
    permissions: resolveRolePermissions(
      role,
      rows.map((item) => item.permission),
    ),
  };
}

export function accessCan(
  access: UserAccess | null | undefined,
  permission: TenantPermission,
) {
  return access ? hasPermission(access.permissions, permission) : false;
}

export function accessCanAny(
  access: UserAccess | null | undefined,
  permissions: readonly TenantPermission[],
) {
  return access ? hasAnyPermission(access.permissions, permissions) : false;
}
