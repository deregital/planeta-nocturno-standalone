'use server';

import { hash } from 'bcrypt';
import { and, eq, ne, sql } from 'drizzle-orm';
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
  type ControlPermission,
  parseControlPermissions,
  SUPER_ADMIN_ROLE_NAME,
} from '@/lib/control/permissions';
import { requirePermission } from '@/server/control/can-manage-tenants';
import { logger } from '@/server/observability/logger';
import { isUniqueViolation } from '@/server/control/custom-id';
import {
  wouldDeleteLastAdminManager,
  wouldRemoveLastAdminManager,
} from '@/server/control/rbac-guards';

const adminBaseSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  email: z.email('Email inválido').max(320),
  roleId: z.uuid('Elegí un rol'),
});

const createAdminSchema = adminBaseSchema.extend({
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

const updateAdminSchema = adminBaseSchema.extend({
  adminId: z.uuid(),
  password: z.string().max(128),
});

export type ControlAdminFormValues = {
  adminId?: string;
  username: string;
  email: string;
  password: string;
  roleId: string;
};

type ControlAdminFormField = keyof ControlAdminFormValues;

export type ControlAdminFormState = {
  values?: ControlAdminFormValues;
  errors?: Partial<Record<ControlAdminFormField | 'general', string>>;
};

export type DeleteControlAdminState = { error?: string };

export async function createControlAdmin(
  _previousState: ControlAdminFormState,
  formData: FormData,
): Promise<ControlAdminFormState> {
  const values = getFormValues(formData);
  const safeValues = { ...values, password: '' };

  const authz = await requirePermission('admins:create');
  if (!authz.ok) {
    return {
      values: safeValues,
      errors: { general: 'No tenés permiso para crear usuarios' },
    };
  }

  const validation = createAdminSchema.safeParse(values);
  if (!validation.success) {
    return {
      values: safeValues,
      errors: fieldErrors(validation.error),
    };
  }

  const roleError = await assignableRoleError(
    validation.data.roleId,
    authz.permissions,
  );
  if (roleError) {
    return { values: safeValues, errors: { roleId: roleError } };
  }

  if (await usernameTakenIgnoringCase(validation.data.username)) {
    return {
      values: safeValues,
      errors: { username: 'Ya existe un usuario con ese nombre' },
    };
  }

  try {
    await getControlDb()
      .insert(controlAdmins)
      .values({
        username: validation.data.username,
        email: validation.data.email,
        password: await hash(validation.data.password, 10),
        roleId: validation.data.roleId,
      });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        values: safeValues,
        errors: { general: 'El usuario o email ya existe' },
      };
    }
    logger.error('Unable to create control admin', { error });
    return {
      values: safeValues,
      errors: { general: 'No se pudo crear el usuario' },
    };
  }

  revalidatePath('/users');
  redirect('/users' as Route);
}

export async function updateControlAdmin(
  _previousState: ControlAdminFormState,
  formData: FormData,
): Promise<ControlAdminFormState> {
  const values = getFormValues(formData);
  const safeValues = { ...values, password: '' };
  const authz = await requirePermission('admins:update');

  if (!authz.ok) {
    return {
      values: safeValues,
      errors: { general: 'No tenés permiso para editar usuarios' },
    };
  }

  const validation = updateAdminSchema.safeParse(values);
  if (!validation.success) {
    return {
      values: safeValues,
      errors: fieldErrors(validation.error),
    };
  }

  const { adminId, username, email, password, roleId } = validation.data;
  const nextPassword = password.trim();

  if (nextPassword && nextPassword.length < 8) {
    return {
      values: safeValues,
      errors: { password: 'Mínimo 8 caracteres' },
    };
  }

  const [existing] = await getControlDb()
    .select({ id: controlAdmins.id, roleId: controlAdmins.roleId })
    .from(controlAdmins)
    .where(eq(controlAdmins.id, adminId))
    .limit(1);

  if (!existing) {
    return {
      values: safeValues,
      errors: { general: 'El usuario no existe' },
    };
  }

  if (roleId !== existing.roleId) {
    const roleError = await assignableRoleError(roleId, authz.permissions);
    if (roleError) {
      return { values: safeValues, errors: { roleId: roleError } };
    }
  }

  if (await usernameTakenIgnoringCase(username, adminId)) {
    return {
      values: safeValues,
      errors: { username: 'Ya existe un usuario con ese nombre' },
    };
  }

  if (
    await wouldRemoveLastAdminManager({
      targetAdminId: adminId,
      nextRoleId: roleId,
    })
  ) {
    return {
      values: safeValues,
      errors: {
        general:
          'No podés quitar el último usuario que puede administrar cuentas',
      },
    };
  }

  try {
    await getControlDb()
      .update(controlAdmins)
      .set({
        username,
        email,
        roleId,
        ...(nextPassword ? { password: await hash(nextPassword, 10) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(controlAdmins.id, adminId));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        values: safeValues,
        errors: { general: 'El usuario o email ya existe' },
      };
    }
    logger.error('Unable to update control admin', { adminId, error });
    return {
      values: safeValues,
      errors: { general: 'No se pudo actualizar el usuario' },
    };
  }

  revalidatePath('/users');
  revalidatePath(`/users/${adminId}`);
  redirect('/users' as Route);
}

export async function deleteControlAdmin(
  _previousState: DeleteControlAdminState,
  formData: FormData,
): Promise<DeleteControlAdminState> {
  const authz = await requirePermission('admins:delete');
  if (!authz.ok) {
    return { error: 'No tenés permiso para eliminar usuarios' };
  }

  const adminId = String(formData.get('adminId') ?? '');
  if (!z.uuid().safeParse(adminId).success) {
    return { error: 'Usuario inválido' };
  }

  if (adminId === authz.session.user.id) {
    return { error: 'No podés eliminar tu propio usuario' };
  }

  if (await wouldDeleteLastAdminManager(adminId)) {
    return {
      error:
        'No podés eliminar el último usuario que puede administrar cuentas',
    };
  }

  try {
    const [deleted] = await getControlDb()
      .delete(controlAdmins)
      .where(eq(controlAdmins.id, adminId))
      .returning({ id: controlAdmins.id });

    if (!deleted) return { error: 'El usuario no existe' };
  } catch (error) {
    logger.error('Unable to delete control admin', { adminId, error });
    return { error: 'No se pudo eliminar el usuario' };
  }

  revalidatePath('/users');
  redirect('/users' as Route);
}

function getFormValues(formData: FormData): ControlAdminFormValues {
  return {
    adminId: String(formData.get('adminId') ?? '') || undefined,
    username: String(formData.get('username') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    roleId: String(formData.get('roleId') ?? ''),
  };
}

function fieldErrors(error: z.ZodError) {
  const treeified = z.treeifyError(error) as {
    properties?: Record<string, { errors: string[] }>;
  };
  const properties = treeified.properties;
  const errors: ControlAdminFormState['errors'] = {};
  for (const [field, fieldError] of Object.entries(properties ?? {})) {
    errors[field as ControlAdminFormField] = fieldError.errors[0];
  }
  return errors;
}

/**
 * Un usuario sólo puede asignar roles con permisos que él mismo tiene: con
 * admins:create alcanzaba para crearse un Super admin.
 */
async function assignableRoleError(
  roleId: string,
  ownPermissions: readonly ControlPermission[],
) {
  const db = getControlDb();
  const [role] = await db
    .select({ id: controlRoles.id, name: controlRoles.name })
    .from(controlRoles)
    .where(eq(controlRoles.id, roleId))
    .limit(1);
  if (!role) return 'El rol seleccionado no existe';

  const rolePermissions =
    role.name === SUPER_ADMIN_ROLE_NAME
      ? [...CONTROL_PERMISSIONS]
      : parseControlPermissions(
          (
            await db
              .select({ permission: controlRolePermissions.permission })
              .from(controlRolePermissions)
              .where(eq(controlRolePermissions.roleId, roleId))
          ).map((row) => row.permission),
        );

  return rolePermissions.every((permission) =>
    ownPermissions.includes(permission),
  )
    ? null
    : 'No podés asignar un rol con permisos que vos no tenés';
}

/** 'Control' y 'control' eran dos cuentas distintas: se veían iguales en la lista. */
async function usernameTakenIgnoringCase(
  username: string,
  exceptAdminId?: string,
) {
  const [taken] = await getControlDb()
    .select({ id: controlAdmins.id })
    .from(controlAdmins)
    .where(
      and(
        sql`lower(${controlAdmins.username}) = lower(${username})`,
        exceptAdminId ? ne(controlAdmins.id, exceptAdminId) : undefined,
      ),
    )
    .limit(1);
  return Boolean(taken);
}
