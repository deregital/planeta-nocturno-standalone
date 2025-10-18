import { isValidPhoneNumber } from 'libphonenumber-js';
import z from 'zod';

import { eventSchema } from '@/server/schemas/event';
import { ticketTypeSchema } from '@/server/schemas/ticket-type';

export const emittedTicketSchema = z.object({
  id: z.string(),
  fullName: z.string().min(2, {
    error: 'El nombre es requerido',
  }),
  dni: z.string().min(4, {
    error: 'El DNI no es valido, asegúrese de no incluir puntos ni comas',
  }),
  mail: z.email({
    error: 'El email no es válido',
  }),
  gender: z.enum(['male', 'female', 'other'], {
    error: 'Seleccione un género válido',
  }),
  phoneNumber: z.string().refine(
    (value) => {
      if (value.startsWith('+5415')) {
        const newNumber = value.replace(/^\+5415/, '+5411');
        return isValidPhoneNumber(newNumber);
      }

      return isValidPhoneNumber(value);
    },
    {
      message: 'El teléfono no es válido',
    },
  ),
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
  .string()
  .max(40, {
    error: 'El nombre no es demasiado largo',
  })
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
