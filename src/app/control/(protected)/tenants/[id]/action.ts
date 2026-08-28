'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { canManageTenants } from '@/server/control/can-manage-tenants';
import { tenantMetadataSchema } from '@/server/schemas/control-tenant';

const tenantEditSchema = tenantMetadataSchema.extend({
  tenantId: z.coerce.number().int().positive(),
});

export type TenantEditValues = {
  tenantId: string;
  name: string;
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

export async function updateTenant(
  _previousState: TenantEditState,
  formData: FormData,
): Promise<TenantEditState> {
  const values = getFormValues(formData);

  if (!(await canManageTenants())) {
    return {
      values,
      errors: { general: 'No tenés permisos para editar páginas' },
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

  try {
    const [updatedTenant] = await getControlDb()
      .update(tenants)
      .set({
        name: data.name,
        description: data.description,
        contactEmail: data.contactEmail,
        faviconUrl: data.faviconUrl,
        hue: data.hue,
        saturation: data.saturation,
        updatedAt: new Date(),
      })
      .where(and(eq(tenants.id, data.tenantId), ne(tenants.status, 'deleted')))
      .returning({ id: tenants.id });

    if (!updatedTenant) {
      return { values, errors: { general: 'La página ya no existe' } };
    }
  } catch (error) {
    console.error('Unable to update tenant', {
      tenantId: data.tenantId,
      error,
    });
    return { values, errors: { general: 'No se pudo actualizar la página' } };
  }

  revalidatePath('/');
  redirect('/');
}

function getFormValues(formData: FormData): TenantEditValues {
  const value = (name: string) => String(formData.get(name) ?? '').trim();

  return {
    tenantId: value('tenantId'),
    name: value('name'),
    description: value('description'),
    contactEmail: value('contactEmail'),
    faviconUrl: value('faviconUrl'),
    hue: value('hue'),
    saturation: value('saturation'),
  };
}
