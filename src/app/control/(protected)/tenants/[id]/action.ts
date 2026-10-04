'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants, tenantSlugAliases } from '@/db/control/schema';
import { requirePermission } from '@/server/control/can-manage-tenants';
import { logger } from '@/server/observability/logger';
import {
  CUSTOM_ID_TAKEN_ERROR,
  getCustomIdAvailabilityError,
  isCustomIdUniqueViolation,
  isUniqueViolation,
} from '@/server/control/custom-id';
import { tenantVisibilityFilter } from '@/server/control/tenant-access';
import {
  deleteExpiredTenantSlugAliases,
  getSubdomainAvailability,
  getTenantSlugTakenError,
  type SubdomainAvailability,
  TENANT_SLUG_TAKEN_ERROR,
} from '@/server/control/tenant-slug';
import { ensureTenantCorsOrigin } from '@/server/s3/ensure-tenant-cors-origin';
import {
  tenantMetadataSchema,
  tenantSubdomainSchema,
} from '@/server/schemas/control-tenant';

const tenantEditSchema = tenantMetadataSchema.extend({
  tenantId: z.coerce.number().int().positive(),
  slug: tenantSubdomainSchema,
});

export type TenantEditValues = {
  tenantId: string;
  customId: string;
  name: string;
  slug: string;
  comments: string;
  description: string;
  contactEmail: string;
  faviconUrl: string;
  hue: string;
  saturation: string;
};

type TenantEditField = keyof TenantEditValues;

export type TenantEditState = {
  values?: TenantEditValues;
  errors?: Partial<Record<TenantEditField | 'general', string>>;
};

export async function checkTenantSlugAvailability(
  value: string,
  tenantId: string,
): Promise<SubdomainAvailability> {
  if (!(await requirePermission('tenants:update')).ok) {
    return { available: false, message: 'No se pudo comprobar el subdominio' };
  }

  return getSubdomainAvailability(value, Number(tenantId));
}

export async function updateTenant(
  _previousState: TenantEditState,
  formData: FormData,
): Promise<TenantEditState> {
  const values = getFormValues(formData);

  const authz = await requirePermission('tenants:update');
  if (!authz.ok) {
    return {
      values,
      errors: { general: 'No tenés permisos para editar plataformas' },
    };
  }

  const validation = tenantEditSchema.safeParse(values);
  if (!validation.success) {
    const properties = z.treeifyError(validation.error).properties;
    const errors: TenantEditState['errors'] = {};

    for (const [field, fieldErrors] of Object.entries(properties ?? {})) {
      errors[field as TenantEditField] = fieldErrors.errors[0];
    }

    return { values, errors };
  }

  const data = validation.data;

  const customIdError = await getCustomIdAvailabilityError(
    data.customId,
    data.tenantId,
  );
  if (customIdError) {
    return { values, errors: { customId: customIdError } };
  }

  const tenantFilter = and(
    eq(tenants.id, data.tenantId),
    ne(tenants.status, 'deleted'),
    tenantVisibilityFilter(authz.session.user.id, authz.permissions),
  );

  const [tenant] = await getControlDb()
    .select({
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
    })
    .from(tenants)
    .where(tenantFilter)
    .limit(1);

  if (!tenant) {
    return { values, errors: { general: 'La plataforma ya no existe' } };
  }

  const slugChanged = data.slug !== tenant.slug;

  if (slugChanged) {
    if (tenant.status === 'provisioning' || tenant.status === 'deleting') {
      return {
        values,
        errors: {
          slug: 'El subdominio no se puede cambiar mientras la plataforma está en proceso',
        },
      };
    }

    const slugError = await getTenantSlugTakenError(data.slug, data.tenantId);
    if (slugError) {
      return { values, errors: { slug: slugError } };
    }

    if (tenant.databaseName) {
      try {
        await ensureTenantCorsOrigin(data.slug);
      } catch (error) {
        logger.error('Unable to allow tenant CORS origin', {
          tenantId: data.tenantId,
          slug: data.slug,
          error,
        });
        return {
          values,
          errors: { general: 'No se pudo habilitar el nuevo subdominio' },
        };
      }
    }
  }

  try {
    const updatedTenant = await getControlDb().transaction(async (tx) => {
      const [updated] = await tx
        .update(tenants)
        .set({
          customId: data.customId,
          name: data.name,
          slug: data.slug,
          comments: data.comments,
          description: data.description,
          contactEmail: data.contactEmail,
          faviconUrl: data.faviconUrl,
          hue: data.hue,
          saturation: data.saturation,
          updatedAt: new Date(),
        })
        .where(and(tenantFilter, eq(tenants.slug, tenant.slug)))
        .returning({ id: tenants.id });

      if (!updated || !slugChanged) return updated;

      await tx
        .delete(tenantSlugAliases)
        .where(eq(tenantSlugAliases.slug, data.slug));

      // Una plataforma sin base nunca atendió tráfico: su slug no necesita alias.
      if (tenant.databaseName) {
        await tx
          .insert(tenantSlugAliases)
          .values({ slug: tenant.slug, tenantId: updated.id })
          .onConflictDoUpdate({
            target: tenantSlugAliases.slug,
            set: { tenantId: updated.id, createdAt: sql`now()` },
          });
      }

      return updated;
    });

    if (!updatedTenant) {
      return { values, errors: { general: 'La plataforma ya no existe' } };
    }
  } catch (error) {
    if (isCustomIdUniqueViolation(error)) {
      return {
        values,
        errors: { customId: CUSTOM_ID_TAKEN_ERROR },
      };
    }
    if (isUniqueViolation(error)) {
      return { values, errors: { slug: TENANT_SLUG_TAKEN_ERROR } };
    }
    logger.error('Unable to update tenant', {
      tenantId: data.tenantId,
      error,
    });
    return {
      values,
      errors: { general: 'No se pudo actualizar la plataforma' },
    };
  }

  try {
    await deleteExpiredTenantSlugAliases();
  } catch (error) {
    logger.error('Unable to delete expired tenant slug aliases', { error });
  }

  revalidatePath('/');
  redirect('/');
}

function getFormValues(formData: FormData): TenantEditValues {
  const value = (name: string) => String(formData.get(name) ?? '').trim();

  return {
    tenantId: value('tenantId'),
    customId: value('customId'),
    name: value('name'),
    slug: value('slug').toLowerCase(),
    comments: value('comments'),
    description: value('description'),
    contactEmail: value('contactEmail'),
    faviconUrl: value('faviconUrl'),
    hue: value('hue'),
    saturation: value('saturation'),
  };
}
