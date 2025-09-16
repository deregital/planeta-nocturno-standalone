import { z } from 'zod';

export const eventSchema = z.object({
  id: z.uuid({
    error: 'El id debe ser UUID',
  }),
  slug: z.string(),
  name: z.string().min(1, { error: 'El nombre es requerido' }),
  description: z.string().min(1, { error: 'La descripción es requerida' }),
  coverImageUrl: z.url({
    error: 'La imagen de portada es requerida',
  }),

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
  authorizedUsersId: z.uuid().array(),
});

export const createEventSchema = eventSchema.omit({
  id: true,
  slug: true,
});

export type EventSchema = z.infer<typeof eventSchema>;
export type CreateEventSchema = z.infer<typeof createEventSchema>;
