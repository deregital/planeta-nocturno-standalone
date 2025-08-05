import z from 'zod';

export const createManyTicketFullSchema = z
  .object({
    fullName: z.string(),
    age: z.number().int().min(0),
    dni: z.string(),
    mail: z.email(),
    gender: z.string(),
    phoneNumber: z.string(),
    instagram: z.string().optional(),
    birthDate: z.string(),
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    paidOnLocation: z.boolean().default(false).optional(),
    eventId: z.uuid().nullable().optional(),
    scannedByUserId: z.uuid().optional(),
  })
  .array();

export const emittedTicketSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  dni: z.string().max(9, {
    error: 'El DNI no es valido, asegúrese de no incluir puntos ni comas',
  }),
  mail: z.email(),
  gender: z.enum(['male', 'female', 'other'], {
    error: 'Seleccione un género válido',
  }),
  phoneNumber: z.string(),
  instagram: z.string().optional(),
  birthDate: z.string(),
  paidOnLocation: z.boolean(),
});

export const createManyTicketSchema = emittedTicketSchema
  .omit({
    gender: true,
  })
  .extend({
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    eventId: z.uuid().nullable().optional(),
    gender: z.string(),
  })
  .array();
