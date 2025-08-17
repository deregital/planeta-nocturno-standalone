import { publicProcedure, router } from '@/server/trpc';

export const eventCategoriesRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.eventCategory.findMany();
  }),
});
