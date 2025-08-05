import { emittedTicket } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import type z from 'zod';
import {
  type createManyTicketFullSchema,
  createManyTicketSchema,
} from '../schemas/emitted-tickets';
import { differenceInYears } from 'date-fns';

export const emittedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const values: z.infer<typeof createManyTicketFullSchema> = input.map(
        ({ id, ...rest }) => ({
          ...rest,
          age: differenceInYears(new Date(), new Date(rest.birthDate)),
        }),
      );
      const res = await ctx.db.insert(emittedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
});
