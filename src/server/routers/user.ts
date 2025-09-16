import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { user as userTable } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import { adminProcedure, publicProcedure, router } from '@/server/trpc';

export const userRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany();
    return users;
  }),
  getTicketingUsers: adminProcedure.query(async ({ ctx }) => {
    const users = await ctx.db.query.user.findMany({
      where: eq(userTable.role, 'TICKETING'),
    });
    return users;
  }),
  getById: adminProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.user.findFirst({
      where: eq(userTable.id, input),
    });
    return user;
  }),
  getByName: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const user = await ctx.db.query.user.findFirst({
      where: eq(userTable.name, input),
    });
    return user;
  }),
  create: adminProcedure.input(userSchema).mutation(async ({ ctx, input }) => {
    const hashedPassword = await hash(input.password, 10);
    const user = await ctx.db.insert(userTable).values({
      ...input,
      fullName: input.fullName,
      name: input.username,
      password: hashedPassword,
    });
    revalidatePath('/admin/users');
    return user;
  }),
  update: adminProcedure
    .input(userSchema.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await hash(input.password, 10);
      const user = await ctx.db
        .update(userTable)
        .set({
          ...input,
          name: input.username,
          password: hashedPassword,
        })
        .where(eq(userTable.id, input.id));

      revalidatePath('/admin/users');
      return user;
    }),
  delete: adminProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.delete(userTable).where(eq(userTable.id, input));

    revalidatePath('/admin/users');
    return user;
  }),
});
