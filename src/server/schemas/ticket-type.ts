import { ticketTypeCategory } from '@/drizzle/schema';
import z from 'zod';

export const ticketTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().min(1).nullable(),
  maxPerPurchase: z.number().min(1),
  maxAvailable: z.number().min(1),
  maxSellDate: z.date().nullable(),
  category: z.enum(ticketTypeCategory.enumValues),
  scanLimit: z.date().nullable(),
});
