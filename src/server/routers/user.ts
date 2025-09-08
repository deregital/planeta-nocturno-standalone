import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { hash } from 'bcrypt';

import { protectedProcedure, router } from '@/server/trpc';
import { user as userTable } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';

export const userRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany();
    return users;
  }),
  getById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.user.findFirst({
        where: eq(userTable.id, input),
      });
      return user;
    }),
  create: protectedProcedure
    .input(userSchema)
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await hash(input.password, 10);
      const user = await ctx.db.insert(userTable).values({
        ...input,
        name: input.username,
        password: hashedPassword,
      });
      return user;
    }),
  update: protectedProcedure
    .input(userSchema)
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await hash(input.password, 10);
      const user = await ctx.db.update(userTable).set({
        ...input,
        password: hashedPassword,
      });
      return user;
    }),
  delete: protectedProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db
        .delete(userTable)
        .where(eq(userTable.id, input));
      return user;
    }),
});
