import { z } from 'zod';

import { role } from '@/drizzle/schema';
import { genderSchema, phoneNumberSchema } from '@/server/schemas/utils';

export const userSchema = z.object({
  name: z.string().min(1, {
    error: 'El nombre de usuario es requerido',
  }),
  password: z.string().min(4, {
    error: 'La contraseña es requerida y debe tener al menos 4 caracteres',
  }),
  email: z.email({
    error: 'El email no es válido',
  }),
  fullName: z.string().min(1, {
    error: 'El nombre completo es requerido',
  }),
  role: z.enum(role.enumValues, {
    error: 'El rol es requerido',
  }),
  gender: genderSchema,
  phoneNumber: phoneNumberSchema,
  dni: z.string().min(1, {
    error: 'El DNI/Pasaporte es requerido',
  }),
  birthDate: z.coerce
    .date({
      error: (issue) => {
        if (issue.code === 'invalid_type' || issue.code === 'invalid_date') {
          return 'La fecha de nacimiento no es válida. Use formato YYYY-MM-DD (ejemplo: 1990-12-31)';
        }
        return 'La fecha de nacimiento debe ser una fecha válida en formato YYYY-MM-DD';
      },
    })
    .min(new Date('1900-01-01').getTime(), {
      error: 'La fecha de nacimiento debe ser posterior al 01/01/1900',
    })
    .transform((date) => {
      // Convert to UTC string
      return date.toISOString();
    }),
  instagram: z.string().nullable(),
});

export const resetPasswordSchema = userSchema
  .pick({
    password: true,
  })
  .extend({
    id: z.string(),
  });
