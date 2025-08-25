import { hash } from 'bcrypt';
import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';

import { eventsRouter } from '@/server/routers/events';
import { publicProcedure, router } from '@/server/trpc';
import { user } from '@/drizzle/schema';
import { ticketGroupRouter } from '@/server/routers/ticket-group';
import { emittedTicketsRouter } from '@/server/routers/emitted-tickets';
import { mercadoPagoRouter } from '@/server/routers/mercado-pago';
import { mailRouter } from '@/server/routers/mail';
import { eventCategoriesRouter } from '@/server/routers/event-categories';
import { userSchema } from '@/server/schemas/user';
import { locationRouter } from '@/server/routers/location';
import { statisticsRouter } from '@/server/routers/statistics';

export const appRouter = router({
  getUsers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findMany();
  }),
  addUser: publicProcedure
    .input(userSchema)
    .mutation(async ({ input, ctx }) => {
      const hashedPassword = await hash(input.password, 10);
      return ctx.db.insert(user).values({
        ...input,
        password: hashedPassword,
      });
    }),
  events: eventsRouter,
  ticketGroup: ticketGroupRouter,
  emittedTickets: emittedTicketsRouter,
  mercadoPago: mercadoPagoRouter,
  mail: mailRouter,
  location: locationRouter,
  eventCategory: eventCategoriesRouter,
  statistics: statisticsRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
