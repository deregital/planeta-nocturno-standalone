import { z } from 'zod';

export const eventFolderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string(),
});

export const createEventFolderSchema = eventFolderSchema.omit({ id: true });

export type EventFolder = z.infer<typeof eventFolderSchema>;
