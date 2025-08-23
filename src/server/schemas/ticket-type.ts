import z from 'zod';

import { ticketTypeCategory } from '@/drizzle/schema';

export const ticketTypeSchema = z.object({
  id: z.uuid({ error: 'El id debe ser un UUID válido' }),
  name: z.string().min(1, { error: 'El nombre es requerido' }),
  description: z.string().min(1, { error: 'La descripción es requerida' }),
  price: z.number().min(0, { error: 'El precio debe ser positivo' }).nullable(),
  maxPerPurchase: z
    .number()
    .min(1, { error: 'Debe ser al menos 1 por compra' }),
  maxAvailable: z.number().min(1, { error: 'Debe ser al menos 1 disponible' }),
  maxSellDate: z.coerce
    .date({ error: 'La fecha de venta máxima no es válida' })
    .nullable(),
  category: z.enum(ticketTypeCategory.enumValues, {
    error: 'La categoría es requerida',
  }),

  scanLimit: z.coerce
    .date({ error: 'La fecha de escaneo no es válida' })
    .nullable(),
});

export const createTicketTypeSchema = ticketTypeSchema;

export type CreateTicketTypeSchema = z.infer<typeof createTicketTypeSchema>;
export type TicketTypeSchema = z.infer<typeof ticketTypeSchema>;
