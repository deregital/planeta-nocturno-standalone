import { TRPCError } from '@trpc/server';
import { count, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { Db } from '@/drizzle';

import {
  accessRole,
  accessRolePermission,
  user as userTable,
} from '@/drizzle/schema';
import {
  deriveLegacyRole,
  isHiddenPermission,
  normalizePermissions,
  SYSTEM_ACCESS_ROLE_IDS,
  TENANT_ROLES,
} from '@/lib/rbac/permissions';
import { loadRolesWithPermissions } from '@/server/rbac/access';
import {
  canGrantPermission,
  canGrantPermissions,
  getManagePermission,
  getUserKind,
} from '@/server/rbac/user-assignment';
import {
  anyPermissionProcedure,
  forbidden,
  permissionProcedure,
  router,
} from '@/server/trpc';

const roleFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'El nombre es requerido' })
    .max(60, { error: 'El nombre debe tener como máximo 60 caracteres' }),
  description: z
    .string()
    .trim()
    .max(240, { error: 'La descripción debe tener como máximo 240 caracteres' })
    .nullish(),
  permissions: z.array(z.string()),
});

function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      current.code === '23505'
    ) {
      return true;
    }
    current =
      typeof current === 'object' && 'cause' in current
        ? current.cause
        : undefined;
  }
  return false;
}

function toGrantablePermissions(values: Iterable<string>) {
  return normalizePermissions(values).filter(
    (permission) => !isHiddenPermission(permission),
  );
}

function duplicateNameError() {
  return new TRPCError({
    code: 'CONFLICT',
    message: 'Ya existe un rol con ese nombre',
  });
}

async function listRoles(db: Db) {
  const [roles, userCounts] = await Promise.all([
    loadRolesWithPermissions(db),
    db
      .select({ roleId: userTable.accessRoleId, count: count() })
      .from(userTable)
      .groupBy(userTable.accessRoleId),
  ]);

  const countByRole = new Map(
    userCounts.map((row) => [row.roleId, Number(row.count)]),
  );

  return roles
    .filter((role) => !role.isHidden)
    .map((role) => ({
      ...role,
      userCount: countByRole.get(role.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      if (a.isSystem) {
        return (
          TENANT_ROLES.indexOf(a.baseRole) - TENANT_ROLES.indexOf(b.baseRole)
        );
      }
      return a.name.localeCompare(b.name, 'es');
    });
}

export const accessRoleRouter = router({
  list: permissionProcedure('roles:read').query(({ ctx }) => listRoles(ctx.db)),

  getById: permissionProcedure('roles:read')
    .input(z.uuid())
    .query(async ({ ctx, input }) => {
      const role = (await listRoles(ctx.db)).find((item) => item.id === input);
      if (!role) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rol no encontrado',
        });
      }
      return role;
    }),

  /** Roles que el usuario actual puede asignar al crear o editar usuarios. */
  getAssignable: anyPermissionProcedure([
    'users:create',
    'users:update',
    'organizers:create',
    'organizers:update',
  ])
    .input(
      z
        .object({
          /**
           * organizer: roles que venden como organizador; staff: el resto;
           * event_staff: roles asignables como personal de un evento.
           */
          kind: z.enum(['organizer', 'staff', 'event_staff']).optional(),
          /** Rol actual del usuario editado: se incluye aunque no sea asignable. */
          includeId: z.uuid().nullish(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const roles = await listRoles(ctx.db);

      return roles
        .filter((role) => {
          const kind = getUserKind(role.permissions);
          if (input?.kind === 'event_staff') {
            if (!role.permissions.includes('events:staff')) return false;
          } else if (input?.kind && input.kind !== kind) {
            return false;
          }
          if (role.id === input?.includeId) return true;
          const canManageKind =
            ctx.can(getManagePermission(kind, 'create')) ||
            ctx.can(getManagePermission(kind, 'update'));
          if (!canManageKind) return false;
          if (
            kind === 'organizer' &&
            role.id !== SYSTEM_ACCESS_ROLE_IDS.ORGANIZER &&
            !ctx.can('organizers:assign_role')
          ) {
            return false;
          }
          return canGrantPermissions(ctx.access, role.permissions);
        })
        .map((role) => ({
          id: role.id,
          name: role.name,
          isSystem: role.isSystem,
          legacyRole: deriveLegacyRole(role.permissions),
        }));
    }),

  create: permissionProcedure('roles:create')
    .input(roleFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const permissions = toGrantablePermissions(input.permissions);

      if (!canGrantPermissions(ctx.access, permissions)) {
        throw forbidden('No podés otorgar permisos que no tenés');
      }

      try {
        return await ctx.db.transaction(async (tx) => {
          const [created] = await tx
            .insert(accessRole)
            .values({
              name: input.name,
              description: input.description || null,
              baseRole: deriveLegacyRole(permissions),
            })
            .returning({ id: accessRole.id });

          if (permissions.length > 0) {
            await tx.insert(accessRolePermission).values(
              permissions.map((permission) => ({
                roleId: created.id,
                permission,
              })),
            );
          }

          return created;
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicateNameError();
        throw error;
      }
    }),

  update: permissionProcedure('roles:update')
    .input(roleFieldsSchema.extend({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const current = (await listRoles(ctx.db)).find(
        (role) => role.id === input.id,
      );

      if (!current) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rol no encontrado',
        });
      }

      if (current.isLocked) {
        throw forbidden(
          'El rol Administrador tiene permisos fijos y no se puede editar',
        );
      }

      const permissions = toGrantablePermissions(input.permissions);
      const added = permissions.filter(
        (permission) => !current.permissions.includes(permission),
      );

      if (
        !added.every((permission) => canGrantPermission(ctx.access, permission))
      ) {
        throw forbidden('No podés otorgar permisos que no tenés');
      }

      const legacyRole = deriveLegacyRole(permissions);

      try {
        await ctx.db.transaction(async (tx) => {
          await tx
            .update(accessRole)
            .set({
              // Los roles de sistema conservan su nombre y su tipo base.
              name: current.isSystem ? current.name : input.name,
              baseRole: current.isSystem ? current.baseRole : legacyRole,
              description: input.description || null,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where(eq(accessRole.id, current.id));

          await tx
            .delete(accessRolePermission)
            .where(eq(accessRolePermission.roleId, current.id));

          if (permissions.length > 0) {
            await tx.insert(accessRolePermission).values(
              permissions.map((permission) => ({
                roleId: current.id,
                permission,
              })),
            );
          }

          await tx
            .update(userTable)
            .set({ role: legacyRole })
            .where(eq(userTable.accessRoleId, current.id));
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicateNameError();
        throw error;
      }

      return { id: current.id };
    }),

  delete: permissionProcedure('roles:delete')
    .input(z.uuid())
    .mutation(async ({ ctx, input }) => {
      const role = (await listRoles(ctx.db)).find((item) => item.id === input);

      if (!role) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Rol no encontrado',
        });
      }

      if (role.isSystem) {
        throw forbidden('Los roles de sistema no se pueden eliminar');
      }

      const [assigned] = await ctx.db
        .select({ count: count() })
        .from(userTable)
        .where(eq(userTable.accessRoleId, role.id));

      if (Number(assigned?.count ?? 0) > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'Hay usuarios con este rol. Asignales otro rol antes de eliminarlo.',
        });
      }

      await ctx.db.delete(accessRole).where(eq(accessRole.id, role.id));
      return { id: role.id };
    }),
});
