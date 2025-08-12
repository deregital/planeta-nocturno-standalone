import { ticketTypeSchema } from '@/server/schemas/ticket-type';
import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  coverImageUrl: z.url(),

  startingDate: z.date(),
  endingDate: z.date(),

  minAge: z.number().min(0).nullable(),
  isActive: z.boolean().default(false),

  locationId: z.string(),
  categoryId: z.string(),

  ticketTypes: z.array(ticketTypeSchema),
});

export type CreateEventSchema = z.infer<typeof createEventSchema>;
