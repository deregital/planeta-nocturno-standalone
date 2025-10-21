import { z } from 'zod';

import { role } from '@/drizzle/schema';
import { genderSchema, phoneNumberSchema } from '@/server/schemas/utils';

export const userSchema = z.object({
  username: z.string().min(1, {
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
    .date()
    .min(new Date('1900-01-01').getTime(), {
      error: 'La fecha de nacimiento es requerida',
    })
    .transform((date) => {
      // Convert to UTC string
      return date.toISOString();
    }),
});
