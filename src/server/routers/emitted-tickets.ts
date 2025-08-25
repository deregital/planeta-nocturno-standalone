import { emittedTicket } from '@/drizzle/schema';
import { protectedProcedure, publicProcedure, router } from '@/server/trpc';
import { differenceInYears } from 'date-fns';
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
      .selectDistinctOn([emittedTicket.dni], {
        dni: emittedTicket.dni,
        fullName: emittedTicket.fullName,
        mail: emittedTicket.mail,
        gender: emittedTicket.gender,
        instagram: emittedTicket.instagram,
        birthDate: emittedTicket.birthDate,
        phoneNumber: emittedTicket.phoneNumber,
      })
      .from(emittedTicket);

    const dataWithAge = data.map((buyer) => ({
      ...buyer,
      age: differenceInYears(new Date(), buyer.birthDate).toString(),
    }));

    return dataWithAge;
  }),
});
