import { user } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import { userSchema } from '../schemas/user';
import { hash } from 'bcrypt';

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
});

export type AppRouter = typeof appRouter;
