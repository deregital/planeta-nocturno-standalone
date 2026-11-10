import z from 'zod';

import { eventSchema } from '@/server/schemas/event';
import { genderSchema, phoneNumberSchema } from '@/server/schemas/utils';

const INVALID_BIRTH_DATE = 'Ingresá una fecha de nacimiento válida';

export const emittedTicketSchema = z.object({
  id: z.string(),
  // Sin trim, un nombre de puros espacios pasaba y la entrada salía sin titular.
  fullName: z
    .string()
    .trim()
    .min(2, {
      error: 'El nombre es requerido',
    })
    .max(120, { error: 'El nombre es demasiado largo' }),
  dni: z
    .string()
    .trim()
    .min(4, {
      error: 'El DNI no es válido',
    })
    .max(20, { error: 'El DNI no es válido' })
    .regex(/^[^.,]+$/, {
      error: 'El DNI no puede contener puntos ni comas',
    }),
  // En minúsculas: el mismo mail en mayúsculas contaba como otro comprador.
  mail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(
      z.email({
        error: 'El email no es válido',
      }),
    ),
  gender: genderSchema,
  phoneNumber: phoneNumberSchema,
  instagram: z.string().trim().max(100).optional(),
  // El mensaje por defecto de zod era 'Invalid input: expected date, received
  // Date'. La comparación con hoy va en el refine para que se evalúe en cada
  // compra y no una sola vez al cargar el módulo.
  birthDate: z.coerce
    .date({ error: INVALID_BIRTH_DATE })
    .min(new Date('1900-01-01'), { error: INVALID_BIRTH_DATE })
    .refine((date) => date <= new Date(), {
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
    ticketTypeId: z.uuid({ error: 'Elegí un tipo de ticket' }),
    invitedBy: invitedBySchema,
    /** Venta en la puerta: la entrada cuenta como ingresada al emitirse. */
    alreadyEntered: z.boolean().optional(),
    /** Confirmado por el staff: emitir aunque el tipo no tenga más cupo. */
    allowOverQuota: z.boolean().optional(),
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
