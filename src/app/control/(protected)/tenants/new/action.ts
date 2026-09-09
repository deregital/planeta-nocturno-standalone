'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { requirePermission } from '@/server/control/can-manage-tenants';
import {
  CUSTOM_ID_TAKEN_ERROR,
  getCustomIdAvailabilityError,
  isCustomIdUniqueViolation,
  isUniqueViolation,
} from '@/server/control/custom-id';
import { tenantVisibilityFilter } from '@/server/control/tenant-access';
import {
  tenantMetadataSchema,
  tenantSubdomainSchema,
} from '@/server/schemas/control-tenant';
import { userSchema } from '@/server/schemas/user';
import { provisionTenant } from '@/server/tenancy/provision-tenant';

const tenantCreationSchema = tenantMetadataSchema.extend({
  slug: tenantSubdomainSchema,
  adminFullName: userSchema.shape.fullName,
  adminEmail: userSchema.shape.email,
  adminUsername: userSchema.shape.name,
  adminPassword: userSchema.shape.password,
  adminDni: userSchema.shape.dni,
  adminPhoneNumber: userSchema.shape.phoneNumber,
  adminBirthDate: z.union([userSchema.shape.birthDate, z.literal('')]),
  adminGender: z.union([userSchema.shape.gender, z.literal('')]),
});

export type TenantFormValues = {
  tenantId?: string;
  customId: string;
  name: string;
  comments: string;
  slug: string;
  description: string;
  contactEmail: string;
  faviconUrl: string;
  hue: string;
  saturation: string;
  adminFullName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminDni: string;
  adminPhoneNumber: string;
  adminBirthDate: string;
  adminGender: string;
};

type TenantFormField = keyof TenantFormValues;

export type TenantFormState = {
  values?: TenantFormValues;
  errors?: Partial<Record<TenantFormField | 'general', string>>;
  credentials?: {
    platformName: string;
    slug: string;
    username: string;
    password: string;
    email: string;
    phoneNumber: string;
  };
};

export type SubdomainAvailability = {
  available: boolean;
  message: string;
};

export async function checkSubdomainAvailability(
  value: string,
  tenantId?: string,
): Promise<SubdomainAvailability> {
  if (!(await requirePermission('tenants:create')).ok) {
    return { available: false, message: 'No se pudo comprobar el subdominio' };
  }

  const validation = tenantSubdomainSchema.safeParse(value);
  if (!validation.success) {
    return {
      available: false,
      message: validation.error.issues[0]?.message ?? 'Subdominio inválido',
    };
  }

  try {
    const [existingTenant] = await getControlDb()
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, validation.data))
      .limit(1);
    const currentTenantId = Number(tenantId);
    const available =
      !existingTenant ||
      (Number.isInteger(currentTenantId) &&
        existingTenant.id === currentTenantId);

    return {
      available,
      message: available
        ? 'Subdominio disponible'
        : 'Ese subdominio ya está en uso',
    };
  } catch (error) {
    console.error('Unable to check subdomain availability', { error });
    return { available: false, message: 'No se pudo comprobar el subdominio' };
  }
}

export async function createTenant(
  _previousState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const values = getFormValues(formData);
  const safeValues = { ...values, adminPassword: '' };
  const authz = await requirePermission('tenants:create');

  if (!authz.ok) {
    return {
      values: safeValues,
      errors: { general: 'No tenés permisos para crear plataformas' },
    };
  }

  const controlAdminSession = authz.session;

  const validation = tenantCreationSchema.safeParse(values);
  if (!validation.success) {
    const properties = z.treeifyError(validation.error).properties;
    const errors: TenantFormState['errors'] = {};

    for (const [field, fieldErrors] of Object.entries(properties ?? {})) {
      errors[field as TenantFormField] = fieldErrors.errors[0];
    }

    return { values: safeValues, errors };
  }

  const data = validation.data;
  const retryTenantId = Number(values.tenantId);
  let tenantId: number;

  const customIdError = await getCustomIdAvailabilityError(
    data.customId,
    Number.isInteger(retryTenantId) && retryTenantId > 0
      ? retryTenantId
      : undefined,
  );
  if (customIdError) {
    return { values: safeValues, errors: { customId: customIdError } };
  }

  try {
    if (Number.isInteger(retryTenantId) && retryTenantId > 0) {
      const [tenant] = await getControlDb()
        .select({
          id: tenants.id,
          slug: tenants.slug,
          status: tenants.status,
          databaseName: tenants.databaseName,
        })
        .from(tenants)
        .where(
          and(
            eq(tenants.id, retryTenantId),
            tenantVisibilityFilter(
              controlAdminSession.user.id,
              authz.permissions,
            ),
          ),
        )
        .limit(1);

      if (!tenant || tenant.slug !== data.slug || tenant.status !== 'failed') {
        return {
          values: safeValues,
          errors: {
            general: 'La plataforma no está disponible para reintentar',
          },
        };
      }

      if (tenant.databaseName) {
        return {
          values: safeValues,
          errors: {
            general:
              'La base incompleta requiere una revisión manual antes de reintentar',
          },
        };
      }

      await getControlDb()
        .update(tenants)
        .set({
          customId: data.customId,
          name: data.name,
          comments: data.comments,
          description: data.description,
          contactEmail: data.contactEmail,
          faviconUrl: data.faviconUrl,
          hue: data.hue,
          saturation: data.saturation,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenants.id, tenant.id),
            tenantVisibilityFilter(
              controlAdminSession.user.id,
              authz.permissions,
            ),
          ),
        );
      tenantId = tenant.id;
    } else {
      const [tenant] = await getControlDb()
        .insert(tenants)
        .values({
          customId: data.customId,
          name: data.name,
          comments: data.comments,
          slug: data.slug,
          description: data.description,
          contactEmail: data.contactEmail,
          faviconUrl: data.faviconUrl,
          hue: data.hue,
          saturation: data.saturation,
          createdByControlAdminId: controlAdminSession.user.id,
        })
        .returning({ id: tenants.id });

      if (!tenant) throw new Error('Tenant was not created');
      tenantId = tenant.id;
    }
  } catch (error) {
    if (isCustomIdUniqueViolation(error)) {
      return {
        values: safeValues,
        errors: { customId: CUSTOM_ID_TAKEN_ERROR },
      };
    }
    if (isUniqueViolation(error)) {
      return {
        values: safeValues,
        errors: { slug: 'Ese subdominio ya está en uso' },
      };
    }

    console.error('Unable to save tenant', { slug: data.slug, error });
    return {
      values: safeValues,
      errors: { general: 'No se pudo guardar la plataforma' },
    };
  }

  try {
    await provisionTenant({
      tenantId,
      admin: {
        name: data.adminUsername,
        password: data.adminPassword,
        email: data.adminEmail,
        fullName: data.adminFullName,
        dni: data.adminDni,
        phoneNumber: data.adminPhoneNumber,
        birthDate: data.adminBirthDate,
        gender: data.adminGender,
      },
    });
  } catch (error) {
    console.error('Tenant provisioning failed', { tenantId, error });
    return {
      values: {
        ...safeValues,
        tenantId: String(tenantId),
      },
      errors: {
        general:
          'No se pudo completar el aprovisionamiento. Revisá el error y reintentá.',
      },
    };
  }

  revalidatePath('/');
  return {
    credentials: {
      platformName: data.name,
      slug: data.slug,
      username: data.adminUsername,
      password: data.adminPassword,
      email: data.adminEmail,
      phoneNumber: data.adminPhoneNumber,
    },
  };
}

function getFormValues(formData: FormData): TenantFormValues {
  const value = (name: string) => String(formData.get(name) ?? '').trim();

  return {
    tenantId: value('tenantId') || undefined,
    customId: value('customId'),
    name: value('name'),
    comments: value('comments'),
    slug: value('slug').toLowerCase(),
    description: value('description'),
    contactEmail: value('contactEmail'),
    faviconUrl: value('faviconUrl'),
    hue: value('hue'),
    saturation: value('saturation'),
    adminFullName: value('adminFullName'),
    adminEmail: value('adminEmail'),
    adminUsername: value('adminUsername'),
    adminPassword: String(formData.get('adminPassword') ?? ''),
    adminDni: value('adminDni'),
    adminPhoneNumber: value('adminPhoneNumber'),
    adminBirthDate: value('adminBirthDate'),
    adminGender: value('adminGender'),
  };
}
