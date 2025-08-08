import { ticketTypeCategory } from '@/drizzle/schema';
import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  coverImageUrl: z.url(),

  startingDate: z.date(),
  endingDate: z.date(),

  minAge: z.number().min(0),
  isActive: z.boolean().default(false),

  locationId: z.string(),
  categoryId: z.string(),

  ticketTypes: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      price: z.number().min(1).nullable(),
      maxPerPurchase: z.number().min(1),
      maxAvailable: z.number().min(1),
      maxSellDate: z.date().nullable(),
      category: z.enum(ticketTypeCategory.enumValues),
      scanLimit: z.date().nullable(),
    }),
  ),
});
