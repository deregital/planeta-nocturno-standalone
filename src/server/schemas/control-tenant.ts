import { z } from 'zod';

import { isReservedTenantSlug } from '@/lib/tenancy/host';

export const tenantMetadataSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(255),
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
    .max(2048, 'La URL del favicon es demasiado larga')
    .refine(
      (value) =>
        !value ||
        (z.url().safeParse(value).success &&
          ['http:', 'https:'].includes(new URL(value).protocol)),
      { message: 'El favicon no es válido' },
    )
    .transform((value) => value || null),
  hue: z.coerce.number().int().min(0).max(360),
  saturation: z.coerce.number().int().min(0).max(100),
});

export const tenantSubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'El subdominio es requerido')
  .max(63, 'El subdominio no puede superar los 63 caracteres')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    'Usá letras minúsculas, números y guiones, sin guiones al inicio o final',
  )
  .refine((slug) => !isReservedTenantSlug(slug), {
    message: 'Ese subdominio está reservado',
  });
