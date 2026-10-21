'use client';

import type { TenantRole } from '@/lib/auth/roles';

import { useEffect, useMemo } from 'react';

import SelectWithLabel from '@/components/common/SelectWithLabel';
import { SYSTEM_ACCESS_ROLE_IDS } from '@/lib/rbac/permissions';
import { trpc } from '@/server/trpc/client';

export type AccessRoleValue = {
  role: TenantRole;
  accessRoleId?: string | null;
};

/**
 * Selector de rol para formularios de usuarios. Lista los roles (de sistema y
 * personalizados) que el usuario actual puede asignar y envía `accessRoleId`
 * en el formulario.
 */
export function AccessRoleSelect({
  kind,
  value,
  onChange,
  currentAccessRoleId,
  error,
  label = 'Rol',
}: {
  /**
   * organizer: roles que venden como organizador; staff: el resto;
   * event_staff: roles asignables como personal de un evento.
   */
  kind: 'organizer' | 'staff' | 'event_staff';
  value: AccessRoleValue;
  onChange: (value: { role: TenantRole; accessRoleId: string }) => void;
  /** Rol actual del usuario editado, para mostrarlo aunque no sea asignable. */
  currentAccessRoleId?: string | null;
  error?: string;
  label?: string;
}) {
  const { data: roles, isLoading } = trpc.accessRole.getAssignable.useQuery({
    kind,
    includeId: currentAccessRoleId,
  });

  const selectedId = value.accessRoleId ?? SYSTEM_ACCESS_ROLE_IDS[value.role];
  const options = useMemo(
    () =>
      (roles ?? []).map((role) => ({
        label: role.name,
        value: role.id,
      })),
    [roles],
  );

  useEffect(() => {
    if (!roles || roles.length === 0) return;
    if (!roles.some((role) => role.id === selectedId)) {
      onChange({ role: roles[0].legacyRole, accessRoleId: roles[0].id });
    }
  }, [roles, selectedId, onChange]);

  return (
    <>
      <SelectWithLabel
        label={label}
        required
        id='accessRoleId'
        value={
          options.some((option) => option.value === selectedId)
            ? selectedId
            : ''
        }
        className='w-full'
        values={options}
        error={
          error ??
          (!isLoading && options.length === 0
            ? 'No tenés roles disponibles para asignar'
            : undefined)
        }
        readOnly={isLoading || options.length === 0}
        onValueChange={(id) => {
          const role = roles?.find((item) => item.id === id);
          if (role) onChange({ role: role.legacyRole, accessRoleId: role.id });
        }}
      />
      {options.some((option) => option.value === selectedId) && (
        <input type='hidden' name='accessRoleId' value={selectedId} />
      )}
    </>
  );
}
