'use server';

import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { LIFECYCLE_PERMISSIONS } from '@/lib/control/permissions';
import { requirePermission } from '@/server/control/can-manage-tenants';
import {
  CUSTOM_ID_TAKEN_ERROR,
  getCustomIdAvailabilityError,
  isCustomIdUniqueViolation,
} from '@/server/control/custom-id';
import { tenantMetadataSchema } from '@/server/schemas/control-tenant';
import { tenantVisibilityFilter } from '@/server/control/tenant-access';

const lifecycleSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  operation: z.enum(['suspend', 'activate', 'recycle', 'restore', 'delete']),
});

export type TenantLifecycleStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'failed'
  | 'deleting'
  | 'deleted';

export type TenantLifecycleState = { error?: string };

const customIdUpdateSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  customId: tenantMetadataSchema.shape.customId,
});

const commentsUpdateSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  comments: tenantMetadataSchema.shape.comments,
});

export type UpdateCustomIdState = { error?: string };
export type UpdateTenantCommentsState = { error?: string; success?: boolean };

export async function updateTenantComments(
  _previousState: UpdateTenantCommentsState,
  formData: FormData,
): Promise<UpdateTenantCommentsState> {
  const authz = await requirePermission('tenants:update');
  if (!authz.ok) {
    return { error: 'No tenés permisos para editar plataformas' };
  }

  const validation = commentsUpdateSchema.safeParse({
    tenantId: formData.get('tenantId'),
    comments: String(formData.get('comments') ?? '').trim(),
  });
  if (!validation.success) {
    return {
      error:
        validation.error.issues[0]?.message ?? 'Los comentarios no son válidos',
    };
  }

  const { tenantId, comments } = validation.data;

  try {
    const [updatedTenant] = await getControlDb()
      .update(tenants)
      .set({ comments, updatedAt: new Date() })
      .where(
        and(
          eq(tenants.id, tenantId),
          ne(tenants.status, 'deleted'),
          tenantVisibilityFilter(authz.session.user.id, authz.permissions),
        ),
      )
      .returning({ id: tenants.id });

    if (!updatedTenant) return { error: 'La plataforma ya no existe' };
  } catch (error) {
    console.error('Unable to update tenant comments', { tenantId, error });
    return { error: 'No se pudieron actualizar los comentarios' };
  }

  revalidatePath('/');
  return { success: true };
}

export async function updateTenantCustomId(
  _previousState: UpdateCustomIdState,
  formData: FormData,
): Promise<UpdateCustomIdState> {
  const authz = await requirePermission('tenants:update');
  if (!authz.ok) {
    return { error: 'No tenés permisos para editar plataformas' };
  }

  const validation = customIdUpdateSchema.safeParse({
    tenantId: formData.get('tenantId'),
    customId: String(formData.get('customId') ?? '').trim(),
  });

  if (!validation.success) {
    return {
      error:
        validation.error.issues[0]?.message ??
        'El ID personalizable no es válido',
    };
  }

  const { tenantId, customId } = validation.data;

  const availabilityError = await getCustomIdAvailabilityError(
    customId,
    tenantId,
  );
  if (availabilityError) {
    return { error: availabilityError };
  }

  try {
    const [updatedTenant] = await getControlDb()
      .update(tenants)
      .set({ customId, updatedAt: new Date() })
      .where(
        and(
          eq(tenants.id, tenantId),
          ne(tenants.status, 'deleted'),
          tenantVisibilityFilter(authz.session.user.id, authz.permissions),
        ),
      )
      .returning({ id: tenants.id });

    if (!updatedTenant) {
      return { error: 'La plataforma ya no existe' };
    }
  } catch (error) {
    if (isCustomIdUniqueViolation(error)) {
      return { error: CUSTOM_ID_TAKEN_ERROR };
    }
    console.error('Unable to update tenant custom id', { tenantId, error });
    return { error: 'No se pudo actualizar el ID personalizable' };
  }

  revalidatePath('/');
  revalidatePath('/trash');
  return {};
}

export async function updateTenantLifecycle(
  _previousState: TenantLifecycleState,
  formData: FormData,
): Promise<TenantLifecycleState> {
  const validation = lifecycleSchema.safeParse({
    tenantId: formData.get('tenantId'),
    operation: formData.get('operation'),
  });
  if (!validation.success) return { error: 'Operación inválida' };

  const { tenantId, operation } = validation.data;

  if (operation === 'delete') {
    return { error: 'La eliminación definitiva no está disponible por ahora' };
  }

  const lifecyclePermission = LIFECYCLE_PERMISSIONS[operation];
  const authz = await requirePermission(lifecyclePermission);
  if (!authz.ok) {
    return { error: 'No tenés permisos para esta acción' };
  }
  const [tenant] = await getControlDb()
    .select({
      id: tenants.id,
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
      deletedAt: tenants.deletedAt,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, tenantId),
        tenantVisibilityFilter(authz.session.user.id, authz.permissions),
      ),
    )
    .limit(1);

  if (!tenant || tenant.status === 'deleted') {
    return { error: 'La plataforma ya no existe' };
  }

  if (operation === 'suspend') {
    if (tenant.status !== 'active')
      return { error: 'La plataforma no está activa' };

    try {
      await getControlDb()
        .update(tenants)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(and(eq(tenants.id, tenantId), eq(tenants.status, 'active')));
    } catch (error) {
      console.error('Unable to suspend tenant', { tenantId, error });
      return { error: 'No se pudo suspender la plataforma' };
    }
  }

  if (operation === 'activate') {
    if (
      tenant.status !== 'suspended' ||
      !tenant.databaseName ||
      tenant.deletedAt
    ) {
      return { error: 'La plataforma no se puede activar' };
    }

    try {
      await getControlDb()
        .update(tenants)
        .set({ status: 'active', updatedAt: new Date() })
        .where(
          and(
            eq(tenants.id, tenantId),
            eq(tenants.status, 'suspended'),
            isNull(tenants.deletedAt),
          ),
        );
    } catch (error) {
      console.error('Unable to activate tenant', { tenantId, error });
      return { error: 'No se pudo activar la plataforma' };
    }
  }

  if (operation === 'recycle') {
    if (tenant.deletedAt) {
      return { error: 'La plataforma ya está en la papelera' };
    }
    if (tenant.status !== 'active' && tenant.status !== 'suspended') {
      return { error: 'La plataforma no se puede enviar a la papelera' };
    }

    try {
      await getControlDb()
        .update(tenants)
        .set({
          status: 'suspended',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(tenants.id, tenantId), isNull(tenants.deletedAt)));
    } catch (error) {
      console.error('Unable to recycle tenant', { tenantId, error });
      return { error: 'No se pudo enviar la plataforma a la papelera' };
    }
  }

  if (operation === 'restore') {
    if (
      tenant.status !== 'suspended' ||
      !tenant.databaseName ||
      !tenant.deletedAt
    ) {
      return { error: 'La plataforma no se puede restaurar' };
    }

    try {
      const [restoredTenant] = await getControlDb()
        .update(tenants)
        .set({
          status: 'active',
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenants.id, tenantId),
            eq(tenants.status, 'suspended'),
            isNotNull(tenants.deletedAt),
          ),
        )
        .returning({ id: tenants.id });

      if (!restoredTenant) {
        return { error: 'La plataforma ya no está en la papelera' };
      }
    } catch (error) {
      console.error('Unable to restore tenant', { tenantId, error });
      return { error: 'No se pudo restaurar la plataforma' };
    }
  }

  revalidatePath('/');
  revalidatePath('/trash');
  return {};
}
