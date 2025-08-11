import { location } from '@/drizzle/schema';
import { createLocationSchema } from '../schemas/location';
import { publicProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';

export const locationRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.query.location.findMany();
    if (!data) throw new Error('Locaciones no encontradas');

    return data;
  }),
  create: publicProcedure
    .input(createLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.db.insert(location).values(input);

      if (!data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se pudo crear la locación',
        });
      }

      return data;
    }),
});
