import 'server-only';

import type { ControlPermission } from '@/lib/control/permissions';

import { and, count, eq, ne, sql } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { controlAdmins, controlRolePermissions } from '@/db/control/schema';

export async function countAdminsWithPermission(
  permission: ControlPermission,
  excludeAdminId?: string,
) {
  const [row] = await getControlDb()
    .select({ value: count() })
    .from(controlAdmins)
    .innerJoin(
      controlRolePermissions,
      eq(controlAdmins.roleId, controlRolePermissions.roleId),
    )
    .where(
      and(
        eq(controlRolePermissions.permission, permission),
        excludeAdminId ? ne(controlAdmins.id, excludeAdminId) : sql`true`,
      ),
    );

  return row?.value ?? 0;
}

export async function wouldRemoveLastAdminManager(options: {
  targetAdminId: string;
  nextRoleId: string;
}) {
  const nextRolePermissions = await getControlDb()
    .select({ permission: controlRolePermissions.permission })
    .from(controlRolePermissions)
    .where(eq(controlRolePermissions.roleId, options.nextRoleId));

  const nextHasAdminUpdate = nextRolePermissions.some(
    (row) => row.permission === 'admins:update',
  );

  if (nextHasAdminUpdate) return false;

  const othersWithUpdate = await countAdminsWithPermission(
    'admins:update',
    options.targetAdminId,
  );

  return othersWithUpdate === 0;
}

export async function wouldDeleteLastAdminManager(targetAdminId: string) {
  const othersWithUpdate = await countAdminsWithPermission(
    'admins:update',
    targetAdminId,
  );
  return othersWithUpdate === 0;
}
