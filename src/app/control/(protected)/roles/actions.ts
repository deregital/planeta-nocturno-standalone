'use server';

import { and, eq, ne } from 'drizzle-orm';
import { type Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import {
  controlAdmins,
  controlRolePermissions,
  controlRoles,
} from '@/db/control/schema';
import {
  CONTROL_PERMISSIONS,
  parseControlPermissions,
  SUPER_ADMIN_ROLE_NAME,
  type ControlPermission,
} from '@/lib/control/permissions';
import { toRoleSlug } from '@/lib/control/role-name';
import { requirePermission } from '@/server/control/can-manage-tenants';
import { isUniqueViolation } from '@/server/control/custom-id';

const roleDisplayNameSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(100, 'Máximo 100 caracteres')
  .transform(toRoleSlug)
  .refine((value) => value.length >= 2, 'El nombre no es válido')
  .refine(
    (value) => value !== SUPER_ADMIN_ROLE_NAME,
    'Ese nombre está reservado',
  );

const roleFormSchema = z.object({
  name: roleDisplayNameSchema,
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
  permissions: z
    .array(z.string())
    .transform((values) => parseControlPermissions(values))
    .refine((values) => values.length > 0, 'Seleccioná al menos un permiso'),
});

export type ControlRoleFormValues = {
  roleId?: string;
  name: string;
  description: string;
  permissions: ControlPermission[];
};

type ControlRoleFormField = keyof ControlRoleFormValues | 'general';

export type ControlRoleFormState = {
  values?: ControlRoleFormValues;
  errors?: Partial<Record<ControlRoleFormField, string>>;
};

export type DeleteControlRoleState = { error?: string };

export async function createControlRole(
  _previousState: ControlRoleFormState,
  formData: FormData,
): Promise<ControlRoleFormState> {
  const values = getFormValues(formData);

  if (!(await requirePermission('roles:create')).ok) {
    return {
      values,
      errors: { general: 'No tenés permiso para crear roles' },
    };
  }

  const validation = roleFormSchema.safeParse({
    name: values.name,
    description: values.description,
    permissions: values.permissions,
  });

  if (!validation.success) {
    return { values, errors: fieldErrors(validation.error) };
  }

  try {
    const [role] = await getControlDb()
      .insert(controlRoles)
      .values({
        name: validation.data.name,
        description: validation.data.description,
        isSystem: false,
      })
      .returning({ id: controlRoles.id });

    if (!role) {
      return { values, errors: { general: 'No se pudo crear el rol' } };
    }

    await getControlDb()
      .insert(controlRolePermissions)
      .values(
        validation.data.permissions.map((permission) => ({
          roleId: role.id,
          permission,
        })),
      );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { values, errors: { name: 'Ya existe un rol con ese nombre' } };
    }
    console.error('Unable to create control role', error);
    return { values, errors: { general: 'No se pudo crear el rol' } };
  }

  revalidatePath('/roles');
  revalidatePath('/users');
  redirect('/roles' as Route);
}

export async function updateControlRole(
  _previousState: ControlRoleFormState,
  formData: FormData,
): Promise<ControlRoleFormState> {
  const values = getFormValues(formData);
  const authz = await requirePermission('roles:update');

  if (!authz.ok) {
    return {
      values,
      errors: { general: 'No tenés permiso para editar roles' },
    };
  }

  const roleId = values.roleId;
  if (!roleId || !z.uuid().safeParse(roleId).success) {
    return { values, errors: { general: 'Rol no válido' } };
  }

  const [existing] = await getControlDb()
    .select({
      id: controlRoles.id,
      name: controlRoles.name,
      isSystem: controlRoles.isSystem,
    })
    .from(controlRoles)
    .where(eq(controlRoles.id, roleId))
    .limit(1);

  if (!existing) {
    return { values, errors: { general: 'El rol no existe' } };
  }

  if (existing.name === SUPER_ADMIN_ROLE_NAME || existing.isSystem) {
    return {
      values,
      errors: {
        general: 'Este rol no se puede modificar',
      },
    };
  }

  const validation = roleFormSchema.safeParse({
    name: values.name,
    description: values.description,
    permissions: values.permissions,
  });

  if (!validation.success) {
    return { values, errors: fieldErrors(validation.error) };
  }

  const currentHasAdminUpdate = await roleHasPermission(
    roleId,
    'admins:update',
  );
  const nextHasAdminUpdate =
    validation.data.permissions.includes('admins:update');

  if (currentHasAdminUpdate && !nextHasAdminUpdate) {
    const holders = await getControlDb()
      .select({ id: controlAdmins.id, roleId: controlAdmins.roleId })
      .from(controlAdmins)
      .innerJoin(
        controlRolePermissions,
        eq(controlAdmins.roleId, controlRolePermissions.roleId),
      )
      .where(eq(controlRolePermissions.permission, 'admins:update'));

    const allOnThisRole =
      holders.length > 0 && holders.every((holder) => holder.roleId === roleId);

    if (allOnThisRole) {
      return {
        values,
        errors: {
          general:
            'No podés quitar la gestión de usuarios del único rol que la tiene',
        },
      };
    }
  }

  try {
    await getControlDb()
      .update(controlRoles)
      .set({
        name: validation.data.name,
        description: validation.data.description,
        updatedAt: new Date(),
      })
      .where(eq(controlRoles.id, roleId));

    await getControlDb()
      .delete(controlRolePermissions)
      .where(eq(controlRolePermissions.roleId, roleId));

    await getControlDb()
      .insert(controlRolePermissions)
      .values(
        validation.data.permissions.map((permission) => ({
          roleId,
          permission,
        })),
      );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { values, errors: { name: 'Ya existe un rol con ese nombre' } };
    }
    console.error('Unable to update control role', { roleId, error });
    return { values, errors: { general: 'No se pudo actualizar el rol' } };
  }

  revalidatePath('/roles');
  revalidatePath(`/roles/${roleId}`);
  revalidatePath('/users');
  redirect('/roles' as Route);
}

export async function deleteControlRole(
  _previousState: DeleteControlRoleState,
  formData: FormData,
): Promise<DeleteControlRoleState> {
  if (!(await requirePermission('roles:delete')).ok) {
    return { error: 'No tenés permiso para eliminar roles' };
  }

  const roleId = String(formData.get('roleId') ?? '');
  if (!z.uuid().safeParse(roleId).success) {
    return { error: 'Rol no válido' };
  }

  const [role] = await getControlDb()
    .select({
      id: controlRoles.id,
      isSystem: controlRoles.isSystem,
      name: controlRoles.name,
    })
    .from(controlRoles)
    .where(eq(controlRoles.id, roleId))
    .limit(1);

  if (!role) return { error: 'El rol no existe' };
  if (role.isSystem || role.name === SUPER_ADMIN_ROLE_NAME) {
    return { error: 'Este rol no se puede eliminar' };
  }

  const [assigned] = await getControlDb()
    .select({ id: controlAdmins.id })
    .from(controlAdmins)
    .where(eq(controlAdmins.roleId, roleId))
    .limit(1);

  if (assigned) {
    return {
      error: 'Primero reasigná a los usuarios que tienen este rol',
    };
  }

  try {
    await getControlDb()
      .delete(controlRoles)
      .where(and(eq(controlRoles.id, roleId), ne(controlRoles.isSystem, true)));
  } catch (error) {
    console.error('Unable to delete control role', { roleId, error });
    return { error: 'No se pudo eliminar el rol' };
  }

  revalidatePath('/roles');
  redirect('/roles' as Route);
}

function getFormValues(formData: FormData): ControlRoleFormValues {
  const permissions = formData
    .getAll('permissions')
    .map(String)
    .filter((value) =>
      (CONTROL_PERMISSIONS as readonly string[]).includes(value),
    ) as ControlPermission[];

  return {
    roleId: String(formData.get('roleId') ?? '') || undefined,
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    permissions,
  };
}

function fieldErrors(error: z.ZodError) {
  const treeified = z.treeifyError(error) as {
    properties?: Record<string, { errors: string[] }>;
  };
  const properties = treeified.properties;
  const errors: ControlRoleFormState['errors'] = {};
  for (const [field, fieldError] of Object.entries(properties ?? {})) {
    errors[field as ControlRoleFormField] = fieldError.errors[0];
  }
  return errors;
}

async function roleHasPermission(
  roleId: string,
  permission: ControlPermission,
) {
  const [row] = await getControlDb()
    .select({ permission: controlRolePermissions.permission })
    .from(controlRolePermissions)
    .where(
      and(
        eq(controlRolePermissions.roleId, roleId),
        eq(controlRolePermissions.permission, permission),
      ),
    )
    .limit(1);
  return Boolean(row);
}
