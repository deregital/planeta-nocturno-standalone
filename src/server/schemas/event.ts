import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido' }),
  description: z.string().min(1, { message: 'La descripción es requerida' }),
  coverImageUrl: z.url(),

  startingDate: z.date({
    error: 'La fecha de inicio es requerida',
  }),
  endingDate: z.date({
    error: 'La fecha de fin es requerida',
  }),

  minAge: z
    .number()
    .min(1, {
      error: 'La edad mínima debe ser mayor a 0',
    })
    .nullable(),
  isActive: z.boolean().default(false),

  locationId: z.uuid({
    error: 'La ubicación es requerida',
  }),
  categoryId: z.uuid({
    error: 'La categoría es requerida',
  }),
});

export type CreateEventSchema = z.infer<typeof createEventSchema>;
