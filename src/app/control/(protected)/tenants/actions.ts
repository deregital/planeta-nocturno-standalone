'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { canManageTenants } from '@/server/control/can-manage-tenants';
import {
  buildDeletedTenantDatabaseName,
  renameTenantDatabase,
} from '@/server/neon/get-database-url';

const lifecycleSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  operation: z.enum(['suspend', 'activate', 'delete']),
});

export type TenantLifecycleStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'failed'
  | 'deleting'
  | 'deleted';

export type TenantLifecycleState = { error?: string };

export async function updateTenantLifecycle(
  _previousState: TenantLifecycleState,
  formData: FormData,
): Promise<TenantLifecycleState> {
  if (!(await canManageTenants())) {
    return { error: 'No tenés permisos para administrar páginas' };
  }

  const validation = lifecycleSchema.safeParse({
    tenantId: formData.get('tenantId'),
    operation: formData.get('operation'),
  });
  if (!validation.success) return { error: 'Operación inválida' };

  const { tenantId, operation } = validation.data;
  const [tenant] = await getControlDb()
    .select({
      id: tenants.id,
      status: tenants.status,
      databaseName: tenants.databaseName,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant || tenant.status === 'deleted') {
    return { error: 'La página ya no existe' };
  }

  if (operation === 'suspend') {
    if (tenant.status !== 'active')
      return { error: 'La página no está activa' };

    try {
      await getControlDb()
        .update(tenants)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(and(eq(tenants.id, tenantId), eq(tenants.status, 'active')));
    } catch (error) {
      console.error('Unable to suspend tenant', { tenantId, error });
      return { error: 'No se pudo suspender la página' };
    }
  }

  if (operation === 'activate') {
    if (tenant.status !== 'suspended' || !tenant.databaseName) {
      return { error: 'La página no se puede activar' };
    }

    try {
      await getControlDb()
        .update(tenants)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(eq(tenants.id, tenantId), eq(tenants.status, 'suspended')));
    } catch (error) {
      console.error('Unable to activate tenant', { tenantId, error });
      return { error: 'No se pudo activar la página' };
    }
  }

  if (operation === 'delete') {
    if (tenant.status === 'provisioning') {
      return { error: 'Esperá a que termine el aprovisionamiento' };
    }

    try {
      await getControlDb()
        .update(tenants)
        .set({ status: 'deleting', updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));

      const deletedDatabaseName = tenant.databaseName
        ? buildDeletedTenantDatabaseName(tenant.databaseName)
        : null;

      if (tenant.databaseName && deletedDatabaseName) {
        await renameTenantDatabase(tenant.databaseName, deletedDatabaseName);
      }

      await getControlDb()
        .update(tenants)
        .set({
          status: 'deleted',
          databaseName: deletedDatabaseName,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));
    } catch (error) {
      console.error('Unable to soft delete tenant', { tenantId, error });
      revalidatePath('/');
      return {
        error:
          'No se pudo completar la eliminación. Si quedó bloqueado, podés reintentar.',
      };
    }
  }

  revalidatePath('/');
  return {};
}
