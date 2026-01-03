import z from 'zod';

import { eventSchema } from '@/server/schemas/event';
import { ticketTypeSchema } from '@/server/schemas/ticket-type';
import { genderSchema, phoneNumberSchema } from '@/server/schemas/utils';

export const emittedTicketSchema = z.object({
  id: z.string(),
  fullName: z.string().min(2, {
    error: 'El nombre es requerido',
  }),
  dni: z
    .string()
    .min(4, {
      error: 'El DNI no es válido',
    })
    .regex(/^[^.,]+$/, {
      error: 'El DNI no puede contener puntos ni comas',
    }),
  mail: z.email({
    error: 'El email no es válido',
  }),
  gender: genderSchema,
  phoneNumber: phoneNumberSchema,
  instagram: z.string().optional(),
  birthDate: z.coerce.date().max(new Date(), {
    error: 'La fecha de nacimiento debe ser previa a hoy',
  }),
  paidOnLocation: z.boolean(),
});

export const createManyTicketSchema = emittedTicketSchema
  .omit({
    id: true,
    gender: true,
  })
  .extend({
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    eventId: z.uuid().nullable().optional(),
    gender: z.string(),
  })
  .array();

export const emittedBuyerTableSchema = emittedTicketSchema
  .omit({
    id: true,
    paidOnLocation: true,
    birthDate: true,
    gender: true,
    instagram: true,
  })
  .extend({
    gender: z.string(),
    age: z.string(),
    instagram: z.string().optional().nullish(),
    birthDate: z.string(),
  });

export const invitedBySchema = z
  .uuid({ message: 'El organizador debe ser válido' })
  .nullable()
  .optional();

// Schema para el código del organizador (6 dígitos hexadecimales)
export const organizerCodeSchema = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/, 'El código debe ser de 6 dígitos hexadecimales')
  .nullable()
  .optional();

export const createTicketSchema = emittedTicketSchema
  .omit({ id: true })
  .extend({
    eventId: eventSchema.shape.id,
    ticketTypeId: ticketTypeSchema.shape.id,
    invitedBy: invitedBySchema,
  });

export const emittedTicketInputSchema = emittedTicketSchema
  .omit({
    id: true,
    paidOnLocation: true,
    gender: true,
  })
  .extend({
    gender: z.string(),
  });

export type EmittedBuyerTable = z.infer<typeof emittedBuyerTableSchema>;

export type CreateManyTicket = z.infer<typeof createManyTicketSchema>;

export type EmittedTicketInput = z.infer<typeof emittedTicketInputSchema>;
