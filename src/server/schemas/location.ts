import z from 'zod';

export const locationSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, {
    error: 'El nombre es requerido',
  }),
  address: z.string().min(1, {
    error: 'La ubicación es requerida',
  }),
  googleMapsUrl: z
    .url({
      error:
        'El link no es válido, podes usar el botón "Compartir" de Google Maps para obtener el link.',
    })
    .min(1, {
      error: 'El link de Google Maps es requerido',
    }),
  capacity: z.int().min(1, {
    error: 'La capacidad debe ser mayor a 0',
  }),
});

export const createLocationSchema = locationSchema.omit({
  id: true,
});

export const updateLocationSchema = locationSchema;

export type Location = z.infer<typeof locationSchema>;
