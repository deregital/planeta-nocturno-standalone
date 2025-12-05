import { z } from 'zod';

export const tagSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .min(1, {
      error: 'El nombre del grupo es requerido',
    })
    .max(20, {
      error: 'El nombre del grupo debe tener menos de 20 caracteres',
    }),
});
