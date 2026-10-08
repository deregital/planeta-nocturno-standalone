'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants, tenantTagAssignments, tenantTags } from '@/db/control/schema';
import { requireAnyPermission } from '@/server/control/can-manage-tenants';
import { isUniqueViolation } from '@/server/control/custom-id';
import {
  TENANT_READ_PERMISSIONS,
  tenantVisibilityFilter,
} from '@/server/control/tenant-access';
import { logger } from '@/server/observability/logger';
import {
  tenantTagIdSchema,
  tenantTagSchema,
} from '@/server/schemas/control-tenant-tag';

export type TenantTagActionState = {
  error?: string;
  tag?: { id: string; name: string; color: string };
};

const NO_PERMISSION_ERROR = 'No tenés permisos para gestionar etiquetas';
const DUPLICATE_NAME_ERROR = 'Ya tenés una etiqueta con ese nombre';

const updateTagSchema = tenantTagSchema.extend({ id: tenantTagIdSchema });

const assignmentSchema = z.object({
  tagId: tenantTagIdSchema,
  tenantId: z.coerce.number().int().positive(),
  assigned: z.boolean(),
});

function revalidateTenantLists() {
  revalidatePath('/');
  revalidatePath('/trash');
}

export async function createTenantTag(input: {
  name: string;
  color: string;
}): Promise<TenantTagActionState> {
  const authz = await requireAnyPermission(TENANT_READ_PERMISSIONS);
  if (!authz.ok) return { error: NO_PERMISSION_ERROR };

  const validation = tenantTagSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message ?? 'Etiqueta inválida',
    };
  }

  try {
    const [tag] = await getControlDb()
      .insert(tenantTags)
      .values({ ...validation.data, controlAdminId: authz.session.user.id })
      .returning({
        id: tenantTags.id,
        name: tenantTags.name,
        color: tenantTags.color,
      });

    revalidateTenantLists();
    return { tag };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    logger.error('Unable to create tenant tag', { error });
    return { error: 'No se pudo crear la etiqueta' };
  }
}

export async function updateTenantTag(input: {
  id: string;
  name: string;
  color: string;
}): Promise<TenantTagActionState> {
  const authz = await requireAnyPermission(TENANT_READ_PERMISSIONS);
  if (!authz.ok) return { error: NO_PERMISSION_ERROR };

  const validation = updateTagSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: validation.error.issues[0]?.message ?? 'Etiqueta inválida',
    };
  }

  const { id, name, color } = validation.data;

  try {
    const [tag] = await getControlDb()
      .update(tenantTags)
      .set({ name, color, updatedAt: new Date() })
      .where(
        and(
          eq(tenantTags.id, id),
          eq(tenantTags.controlAdminId, authz.session.user.id),
        ),
      )
      .returning({
        id: tenantTags.id,
        name: tenantTags.name,
        color: tenantTags.color,
      });

    if (!tag) return { error: 'La etiqueta ya no existe' };

    revalidateTenantLists();
    return { tag };
  } catch (error) {
    if (isUniqueViolation(error)) return { error: DUPLICATE_NAME_ERROR };
    logger.error('Unable to update tenant tag', { tagId: id, error });
    return { error: 'No se pudo editar la etiqueta' };
  }
}

export async function deleteTenantTag(
  tagId: string,
): Promise<TenantTagActionState> {
  const authz = await requireAnyPermission(TENANT_READ_PERMISSIONS);
  if (!authz.ok) return { error: NO_PERMISSION_ERROR };

  const validation = tenantTagIdSchema.safeParse(tagId);
  if (!validation.success) return { error: 'Etiqueta inválida' };

  try {
    const [deletedTag] = await getControlDb()
      .delete(tenantTags)
      .where(
        and(
          eq(tenantTags.id, validation.data),
          eq(tenantTags.controlAdminId, authz.session.user.id),
        ),
      )
      .returning({ id: tenantTags.id });

    if (!deletedTag) return { error: 'La etiqueta ya no existe' };
  } catch (error) {
    logger.error('Unable to delete tenant tag', { tagId, error });
    return { error: 'No se pudo eliminar la etiqueta' };
  }

  revalidateTenantLists();
  return {};
}

export async function setTenantTagAssignment(input: {
  tagId: string;
  tenantId: number;
  assigned: boolean;
}): Promise<TenantTagActionState> {
  const authz = await requireAnyPermission(TENANT_READ_PERMISSIONS);
  if (!authz.ok) return { error: NO_PERMISSION_ERROR };

  const validation = assignmentSchema.safeParse(input);
  if (!validation.success) return { error: 'Operación inválida' };

  const { tagId, tenantId, assigned } = validation.data;
  const db = getControlDb();

  const [[tag], [tenant]] = await Promise.all([
    db
      .select({ id: tenantTags.id })
      .from(tenantTags)
      .where(
        and(
          eq(tenantTags.id, tagId),
          eq(tenantTags.controlAdminId, authz.session.user.id),
        ),
      )
      .limit(1),
    db
      .select({ id: tenants.id })
      .from(tenants)
      .where(
        and(
          eq(tenants.id, tenantId),
          ne(tenants.status, 'deleted'),
          tenantVisibilityFilter(authz.session.user.id, authz.permissions),
        ),
      )
      .limit(1),
  ]);

  if (!tag) return { error: 'La etiqueta ya no existe' };
  if (!tenant) return { error: 'La plataforma ya no existe' };

  try {
    if (assigned) {
      await db
        .insert(tenantTagAssignments)
        .values({ tagId, tenantId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(tenantTagAssignments)
        .where(
          and(
            eq(tenantTagAssignments.tagId, tagId),
            eq(tenantTagAssignments.tenantId, tenantId),
          ),
        );
    }
  } catch (error) {
    logger.error('Unable to update tenant tag assignment', {
      tagId,
      tenantId,
      error,
    });
    return { error: 'No se pudo actualizar la etiqueta de la plataforma' };
  }

  revalidateTenantLists();
  return {};
}
