import 'server-only';

import type { ControlPermission } from '@/lib/control/permissions';

import { eq } from 'drizzle-orm';

import { tenants } from '@/db/control/schema';

export const TENANT_READ_PERMISSIONS = [
  'tenants:read',
  'tenants:read_all',
] as const satisfies readonly ControlPermission[];

export function canViewAllTenants(permissions: readonly ControlPermission[]) {
  return permissions.includes('tenants:read_all');
}

export function tenantVisibilityFilter(
  adminId: string,
  permissions: readonly ControlPermission[],
) {
  return canViewAllTenants(permissions)
    ? undefined
    : eq(tenants.createdByControlAdminId, adminId);
}
