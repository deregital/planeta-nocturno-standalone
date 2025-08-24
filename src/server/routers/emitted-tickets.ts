import { emittedTicket } from '@/drizzle/schema';
import { protectedProcedure, publicProcedure, router } from '@/server/trpc';
import { createManyTicketSchema } from '../schemas/emitted-tickets';

export const emittedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input.map((ticket) => ({
        ...ticket,
        birthDate: ticket.birthDate.toISOString(),
      }));
      const res = await ctx.db.insert(emittedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
  getAllUniqueBuyer: protectedProcedure.query(async ({ ctx }) => {
    const data = await ctx.db
      .selectDistinctOn([emittedTicket.dni])
      .from(emittedTicket);

    return data;
  }),
});
