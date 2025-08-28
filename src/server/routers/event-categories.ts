import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { eventCategory } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import { eventCategorySchema } from '@/server/schemas/event-category';

export const eventCategoriesRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.eventCategory.findMany();
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
  create: publicProcedure
    .input(eventCategorySchema.omit({ id: true }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(eventCategory).values(input);
    }),
  edit: publicProcedure
    .input(eventCategorySchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(eventCategory)
        .set(input)
        .where(eq(eventCategory.id, input.id));
    }),
});
