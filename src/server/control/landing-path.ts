import 'server-only';

import type { ControlPermission } from '@/lib/control/permissions';

import { type Route } from 'next';

import { getControlAdminPermissions } from '@/server/control/can-manage-tenants';

export async function getControlLandingPath(
  permissions?: ControlPermission[] | null,
): Promise<Route> {
  const resolved = permissions ?? (await getControlAdminPermissions()) ?? [];

  if (resolved.includes('tenants:read')) return '/';
  if (resolved.includes('admins:read')) return '/users' as Route;
  if (resolved.includes('roles:read')) return '/roles' as Route;
  return '/login';
}
