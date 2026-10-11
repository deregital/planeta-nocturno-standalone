'use client';

import { usePermissions } from '@/components/rbac/PermissionsProvider';
import { type TenantPermission } from '@/lib/rbac/permissions';

/**
 * Muestra su contenido solo si el usuario tiene el permiso (o todos/alguno de
 * los permisos indicados). Es solo visual: el servidor valida cada acción.
 */
export function Can({
  permission,
  allOf,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: TenantPermission;
  allOf?: readonly TenantPermission[];
  anyOf?: readonly TenantPermission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAll, canAny } = usePermissions();

  const allowed =
    (!permission || can(permission)) &&
    (!allOf || canAll(allOf)) &&
    (!anyOf || canAny(anyOf));

  return allowed ? children : fallback;
}
