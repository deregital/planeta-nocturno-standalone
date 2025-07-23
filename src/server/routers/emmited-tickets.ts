import { emmitedTicket } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import z from 'zod';

export const createManyTicketSchema = z
  .object({
    fullName: z.string(),
    age: z.number().int().min(0),
    dni: z.string(),
    mail: z.email(),
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

export const emmitedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.insert(emmitedTicket).values(input).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
});
