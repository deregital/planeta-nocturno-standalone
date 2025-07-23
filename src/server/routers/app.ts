import { user } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import { userSchema } from '../schemas/user';
import { hash } from 'bcrypt';
import { eventsRouter } from '@/server/routers/events';
import { type inferRouterOutputs } from '@trpc/server';
import { ticketGroupRouter } from './ticket-group';
import { emmitedTicketsRouter } from './emmited-tickets';

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
  tickets: emmitedTicketsRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
