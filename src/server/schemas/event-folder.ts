import { z } from 'zod';

export const eventFolderSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, { message: 'El nombre es requerido' }),
  color: z.string(),
});

export const createEventFolderSchema = eventFolderSchema.omit({ id: true });

export type EventFolder = z.infer<typeof eventFolderSchema>;
