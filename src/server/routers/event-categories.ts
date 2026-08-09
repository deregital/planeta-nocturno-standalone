import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import z from 'zod';

import { eventCategory } from '@/drizzle/schema';
import { adminProcedure, publicProcedure, router } from '@/server/trpc';
import { eventCategorySchema } from '@/server/schemas/event-category';

export const eventCategoriesRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.eventCategory.findMany({
      orderBy: asc(eventCategory.sortOrder),
    });
  }),
  getActive: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.eventCategory.findMany({
      where: eq(eventCategory.isActive, true),
      orderBy: asc(eventCategory.sortOrder),
    });
  }),
  getById: publicProcedure
    .input(eventCategorySchema.shape.id)
    .query(async ({ ctx, input }) => {
      const data = ctx.db.query.eventCategory.findFirst({
        where: eq(eventCategory.id, input),
      });

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Categoria de evento no encontrada',
        });
      }

      return data;
    }),
  create: adminProcedure
    .input(eventCategorySchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.eventCategory.findMany({
        orderBy: asc(eventCategory.sortOrder),
      });
      const maxSortOrder =
        existing.length > 0
          ? Math.max(...existing.map((c) => c.sortOrder))
          : -1;
      const [created] = await ctx.db
        .insert(eventCategory)
        .values({ ...input, sortOrder: maxSortOrder + 1 })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se pudo crear la categoría',
        });
      }

      return created;
    }),
  edit: adminProcedure
    .input(eventCategorySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(eventCategory)
        .set(input)
        .where(eq(eventCategory.id, input.id));
    }),
  toggleActive: adminProcedure
    .input(z.object({ id: z.uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(eventCategory)
        .set({ isActive: input.isActive })
        .where(eq(eventCategory.id, input.id));
    }),
  reorder: adminProcedure
    .input(z.array(z.object({ id: z.uuid(), sortOrder: z.number().int() })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.map(({ id, sortOrder }) =>
          ctx.db
            .update(eventCategory)
            .set({ sortOrder })
            .where(eq(eventCategory.id, id)),
        ),
      );
    }),
});
