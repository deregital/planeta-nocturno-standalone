'use client';

import { createContext, useContext, useMemo } from 'react';

import {
  hasAnyPermission,
  hasPermission,
  type TenantPermission,
} from '@/lib/rbac/permissions';

type PermissionsContextValue = {
  roleName: string | null;
  permissions: ReadonlySet<TenantPermission>;
};

const PermissionsContext = createContext<PermissionsContextValue>({
  roleName: null,
  permissions: new Set(),
});

export function PermissionsProvider({
  roleName,
  permissions,
  children,
}: {
  roleName: string | null;
  permissions: readonly TenantPermission[];
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ roleName, permissions: new Set(permissions) }),
    [roleName, permissions],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const { roleName, permissions } = useContext(PermissionsContext);

  return useMemo(
    () => ({
      roleName,
      permissions,
      can: (permission: TenantPermission) =>
        hasPermission(permissions, permission),
      canAny: (required: readonly TenantPermission[]) =>
        hasAnyPermission(permissions, required),
      canAll: (required: readonly TenantPermission[]) =>
        required.every((permission) => hasPermission(permissions, permission)),
    }),
    [roleName, permissions],
  );
}

export function useCan(permission: TenantPermission) {
  return usePermissions().can(permission);
}
