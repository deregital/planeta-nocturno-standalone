import { emmitedTicket } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
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
    paidOnLocation: z.boolean(),
    eventId: z.uuid().nullable().optional(),
    scannedByUserId: z.uuid().nullable(),
  })
  .array();

export const createManyTicketSchema = z
  .object({
    id: z.string(),
    fullName: z.string(),
    dni: z.string(),
    mail: z.email(),
    gender: z.string(),
    phoneNumber: z.string(),
    instagram: z.string().optional(),
    birthDate: z.string(),
    ticketTypeId: z.uuid(),
    ticketGroupId: z.uuid(),
    eventId: z.uuid().nullable().optional(),
  })
  .array();

export const emittedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const values: z.infer<typeof createManyTicketFullSchema> = input.map(
        ({ id, ...rest }) => ({
          ...rest,
          age: 10,
          paidOnLocation: false,
          scannedByUserId: null,
        }),
      );
      console.log('values:', values);
      const res = await ctx.db.insert(emmitedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
});
