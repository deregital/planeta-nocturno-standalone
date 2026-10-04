import { z } from 'zod';

import { TAG_COLOR_REGEX } from '@/lib/control/tag-colors';

export const TENANT_TAG_NAME_MAX_LENGTH = 50;

export const tenantTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(
      TENANT_TAG_NAME_MAX_LENGTH,
      `El nombre no puede superar los ${TENANT_TAG_NAME_MAX_LENGTH} caracteres`,
    ),
  color: z
    .string()
    .trim()
    .regex(TAG_COLOR_REGEX, 'El color debe tener el formato #ABCDEF')
    .transform((value) => value.toUpperCase()),
});

export const tenantTagIdSchema = z.uuid('Etiqueta inválida');
