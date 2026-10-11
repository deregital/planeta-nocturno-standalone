import 'server-only';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { accessRole, user } from '@/drizzle/schema';
import {
  deriveLegacyRole,
  hasPermission,
  isCapability,
  isHiddenPermission,
  SYSTEM_ACCESS_ROLE_IDS,
  type TenantPermission,
} from '@/lib/rbac/permissions';
import {
  isHiddenUser,
  loadUserAccess,
  resolveRolePermissions,
  type UserAccess,
} from '@/server/rbac/access';

type RbacContext = {
  db: Db;
  session: { user: { id: string } };
  access: UserAccess;
  can: (permission: TenantPermission) => boolean;
};

type ManageAction = 'create' | 'update' | 'delete';

/** Los organizadores se gestionan con los permisos de organizadores; el resto, con los de usuarios. */
export type UserKind = 'organizer' | 'staff';

const MANAGE_PERMISSIONS = {
  staff: {
    create: 'users:create',
    update: 'users:update',
    delete: 'users:delete',
  },
  organizer: {
    create: 'organizers:create',
    update: 'organizers:update',
    delete: 'organizers:delete',
  },
} as const satisfies Record<UserKind, Record<ManageAction, TenantPermission>>;

export function getUserKind(
  permissions: readonly TenantPermission[],
): UserKind {
  return permissions.includes('organizer:act') ? 'organizer' : 'staff';
}

export function getManagePermission(kind: UserKind, action: ManageAction) {
  return MANAGE_PERMISSIONS[kind][action];
}

function forbidden(message: string) {
  return new TRPCError({ code: 'FORBIDDEN', message });
}

/**
 * Nadie puede otorgar un permiso de acceso que no tiene. Las capacidades
 * (p. ej. vender como organizador) no dan acceso por sí solas.
 */
export function canGrantPermission(
  actor: UserAccess,
  permission: TenantPermission,
) {
  if (isHiddenPermission(permission)) return false;
  return (
    hasPermission(actor.permissions, permission) || isCapability(permission)
  );
}

export function canGrantPermissions(
  actor: UserAccess,
  permissions: readonly TenantPermission[],
) {
  return permissions.every((permission) =>
    canGrantPermission(actor, permission),
  );
}

export async function resolveAccessRole(db: Db, accessRoleId: string) {
  const row = await db.query.accessRole.findFirst({
    where: eq(accessRole.id, accessRoleId),
    with: { accessRolePermissions: { columns: { permission: true } } },
  });

  const permissions = row
    ? resolveRolePermissions(
        row,
        row.accessRolePermissions.map((item) => item.permission),
      )
    : [];

  if (!row || permissions.some(isHiddenPermission)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El rol seleccionado no existe',
    });
  }

  return {
    id: row.id,
    name: row.name,
    isSystem: row.isSystem,
    permissions,
    kind: getUserKind(permissions),
    legacyRole: deriveLegacyRole(permissions),
  };
}

/**
 * Valida que el actor pueda asignar el rol indicado. Sin rol explícito se
 * asigna el rol de sistema Organizador.
 */
export async function assertCanAssignRole(
  ctx: RbacContext,
  accessRoleId: string | null | undefined,
  action: 'create' | 'update',
  currentAccessRoleId?: string | null,
) {
  const resolved = await resolveAccessRole(
    ctx.db,
    accessRoleId ?? SYSTEM_ACCESS_ROLE_IDS.ORGANIZER,
  );

  if (!ctx.can(getManagePermission(resolved.kind, action))) {
    throw forbidden('No tenés permiso para asignar este rol');
  }

  if (resolved.id === currentAccessRoleId) return resolved;

  if (
    resolved.kind === 'organizer' &&
    resolved.id !== SYSTEM_ACCESS_ROLE_IDS.ORGANIZER &&
    !ctx.can('organizers:assign_role')
  ) {
    throw forbidden('No tenés permiso para elegir el rol de los organizadores');
  }

  if (!canGrantPermissions(ctx.access, resolved.permissions)) {
    throw forbidden(
      `No podés asignar el rol "${resolved.name}" porque incluye permisos que no tenés`,
    );
  }

  return resolved;
}

/**
 * Valida que el actor pueda modificar o eliminar a otro usuario: necesita el
 * permiso según el rol del usuario, alcance sobre él (equipo propio si no ve a
 * todos los organizadores) y tener al menos todos sus permisos de acceso.
 */
export async function assertCanManageUser(
  ctx: RbacContext,
  targetId: string,
  action: 'update' | 'delete',
) {
  const target = await ctx.db.query.user.findFirst({
    where: eq(user.id, targetId),
    columns: { id: true, chiefOrganizerId: true, accessRoleId: true },
  });

  const isSelf = target?.id === ctx.session.user.id;

  if (!target || (!isSelf && isHiddenUser(target))) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Usuario no encontrado',
    });
  }

  const targetAccess = await loadUserAccess(ctx.db, target.id);
  const targetPermissions = targetAccess?.permissions ?? [];
  const kind = getUserKind(targetPermissions);

  if (!ctx.can(getManagePermission(kind, action))) {
    throw forbidden('No tenés permiso para modificar este usuario');
  }

  if (
    !isSelf &&
    kind === 'organizer' &&
    !ctx.can('organizers:read_all') &&
    target.chiefOrganizerId !== ctx.session.user.id
  ) {
    throw forbidden('No tenés acceso a este organizador');
  }

  if (!isSelf && !canGrantPermissions(ctx.access, targetPermissions)) {
    throw forbidden(
      'No podés modificar a un usuario con permisos que vos no tenés',
    );
  }

  return target;
}
