import { user } from '@/drizzle/schema';
import { emittedTicketsRouter } from '@/server/routers/emitted-tickets';
import { eventCategoriesRouter } from '@/server/routers/event-categories';
import { eventsRouter } from '@/server/routers/events';
import { mailRouter } from '@/server/routers/mail';
import { mercadoPagoRouter } from '@/server/routers/mercado-pago';
import { ticketGroupRouter } from '@/server/routers/ticket-group';
import { publicProcedure, router } from '@/server/trpc';
import { type inferRouterOutputs } from '@trpc/server';
import { hash } from 'bcrypt';
import { userSchema } from '../schemas/user';
import { locationRouter } from './location';
import { statisticsRouter } from './statistics';

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
