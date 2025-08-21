import z from 'zod';

export const eventCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, {
    error: 'El nombre es requerido',
  }),
});
