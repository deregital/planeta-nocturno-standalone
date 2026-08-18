'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { isReservedTenantSlug } from '@/lib/tenancy/host';
import { auth } from '@/server/auth';
import { isControlRequest } from '@/server/control/is-control-request';
import { userSchema } from '@/server/schemas/user';
import { phoneNumberSchema } from '@/server/schemas/utils';
import { provisionTenant } from '@/server/tenancy/provision-tenant';

const tenantCreationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'El slug es requerido')
    .max(63, 'El slug no puede superar los 63 caracteres')
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      'Usá letras minúsculas, números y guiones, sin guiones al inicio o final',
    )
    .refine((slug) => !isReservedTenantSlug(slug), {
      message: 'Ese slug está reservado',
    }),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar los 1000 caracteres')
    .transform((value) => value || null),
  contactEmail: z
    .string()
    .trim()
    .refine((value) => !value || z.email().safeParse(value).success, {
      message: 'El email de contacto no es válido',
    })
    .transform((value) => value || null),
  faviconUrl: z
    .string()
    .trim()
    .refine((value) => !value || z.url().safeParse(value).success, {
      message: 'La URL del ícono no es válida',
    })
    .transform((value) => value || null),
  hue: z.coerce.number().int().min(0).max(360),
  saturation: z.coerce.number().int().min(0).max(100),
  plan: z.enum(['free', 'pro']),
  adminFullName: userSchema.shape.fullName,
  adminEmail: userSchema.shape.email,
  adminBirthDate: userSchema.shape.birthDate,
  adminPhoneNumber: phoneNumberSchema,
  adminDni: userSchema.shape.dni,
  adminGender: userSchema.shape.gender,
  adminUsername: userSchema.shape.name,
  adminPassword: userSchema.shape.password,
});

export type TenantFormValues = {
  tenantId?: string;
  name: string;
  slug: string;
  description: string;
  contactEmail: string;
  faviconUrl: string;
  hue: string;
  saturation: string;
  plan: string;
  adminFullName: string;
  adminEmail: string;
  adminBirthDate: string;
  adminPhoneNumber: string;
  adminDni: string;
  adminGender: string;
  adminUsername: string;
  adminPassword: string;
};

type TenantFormField = keyof TenantFormValues;

export type TenantFormState = {
  values?: TenantFormValues;
  errors?: Partial<Record<TenantFormField | 'general', string>>;
};

export async function createTenant(
  _previousState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const values = getFormValues(formData);
  const safeValues = { ...values, adminPassword: '' };

  if (!(await canManageTenants())) {
    return {
      values: safeValues,
      errors: { general: 'No tenés permisos para crear tenants' },
    };
  }

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
        .where(eq(tenants.id, retryTenantId))
        .limit(1);

      if (!tenant || tenant.slug !== data.slug || tenant.status !== 'failed') {
        return {
          values: safeValues,
          errors: { general: 'El tenant no está disponible para reintentar' },
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
          name: data.name,
          description: data.description,
          contactEmail: data.contactEmail,
          faviconUrl: data.faviconUrl,
          hue: data.hue,
          saturation: data.saturation,
          plan: data.plan,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenant.id));
      tenantId = tenant.id;
    } else {
      const [tenant] = await getControlDb()
        .insert(tenants)
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description,
          contactEmail: data.contactEmail,
          faviconUrl: data.faviconUrl,
          hue: data.hue,
          saturation: data.saturation,
          plan: data.plan,
        })
        .returning({ id: tenants.id });

      if (!tenant) throw new Error('Tenant was not created');
      tenantId = tenant.id;
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        values: safeValues,
        errors: { slug: 'Ya existe un tenant con ese slug' },
      };
    }

    console.error('Unable to save tenant', { slug: data.slug, error });
    return {
      values: safeValues,
      errors: { general: 'No se pudo guardar el tenant' },
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
        gender: data.adminGender,
        phoneNumber: data.adminPhoneNumber,
        dni: data.adminDni,
        birthDate: data.adminBirthDate,
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
  redirect('/');
}

function getFormValues(formData: FormData): TenantFormValues {
  const value = (name: string) => String(formData.get(name) ?? '').trim();

  return {
    tenantId: value('tenantId') || undefined,
    name: value('name'),
    slug: value('slug').toLowerCase(),
    description: value('description'),
    contactEmail: value('contactEmail'),
    faviconUrl: value('faviconUrl'),
    hue: value('hue'),
    saturation: value('saturation'),
    plan: value('plan'),
    adminFullName: value('adminFullName'),
    adminEmail: value('adminEmail'),
    adminBirthDate: value('adminBirthDate'),
    adminPhoneNumber: value('adminPhoneNumber'),
    adminDni: value('adminDni'),
    adminGender: value('adminGender'),
    adminUsername: value('adminUsername'),
    adminPassword: String(formData.get('adminPassword') ?? ''),
  };
}

async function canManageTenants() {
  const session = await auth();
  if (session?.user.role !== 'CONTROL_ADMIN') return false;
  return isControlRequest(new Headers(await headers()));
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
