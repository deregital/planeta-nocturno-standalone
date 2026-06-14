import { and, eq, not, sql } from 'drizzle-orm';
import z from 'zod';

import { tag, userXTag } from '@/drizzle/schema';
import { chiefOrganizerProcedure, router } from '@/server/trpc';
import { assertTagOwnedByUser } from '@/server/utils/tags';

export const tagRouter = router({
  getAll: chiefOrganizerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tag.findMany({
      where: eq(tag.createdById, ctx.session.user.id),
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });
  }),
  create: chiefOrganizerProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const existingTag = await ctx.db.query.tag.findFirst({
        where: and(
          sql`lower(${tag.name}) = lower(${input})`,
          eq(tag.createdById, ctx.session.user.id),
        ),
      });

      if (existingTag) {
        throw new Error('Ya existe un grupo con ese nombre');
      }

      const [createdTag] = await ctx.db
        .insert(tag)
        .values({ name: input, createdById: ctx.session.user.id })
        .returning();
      return createdTag;
    }),
  update: chiefOrganizerProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTagOwnedByUser(ctx.db, input.id, ctx.session.user.id);

      const existingTag = await ctx.db.query.tag.findFirst({
        where: and(
          sql`lower(${tag.name}) = lower(${input.name})`,
          eq(tag.createdById, ctx.session.user.id),
          not(eq(tag.id, input.id)),
        ),
      });

      if (existingTag) {
        throw new Error('Ya existe un grupo con ese nombre');
      }

      const updatedTag = await ctx.db
        .update(tag)
        .set({ name: input.name })
        .where(eq(tag.id, input.id));
      return updatedTag;
    }),
  delete: chiefOrganizerProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      await assertTagOwnedByUser(ctx.db, input, ctx.session.user.id);

      const deletedTag = await ctx.db.delete(tag).where(eq(tag.id, input));
      return deletedTag;
    }),
  removeUserFromTag: chiefOrganizerProcedure
    .input(z.object({ userId: z.string(), tagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertTagOwnedByUser(ctx.db, input.tagId, ctx.session.user.id);

      const removedUserFromTag = await ctx.db
        .delete(userXTag)
        .where(and(eq(userXTag.a, input.tagId), eq(userXTag.b, input.userId)));
      return removedUserFromTag;
    }),
  addUserToTag: chiefOrganizerProcedure
    .input(
      z.object({
        userId: z.string(),
        tagId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTagOwnedByUser(ctx.db, input.tagId, ctx.session.user.id);

      const existing = await ctx.db.query.userXTag.findFirst({
        where: and(eq(userXTag.a, input.tagId), eq(userXTag.b, input.userId)),
      });

      if (existing) {
        return { success: true, message: 'El usuario ya está en este grupo' };
      }

      await ctx.db.insert(userXTag).values({
        a: input.tagId,
        b: input.userId,
      });

      return {
        success: true,
        message: 'Usuario agregado al grupo exitosamente',
      };
    }),
});
