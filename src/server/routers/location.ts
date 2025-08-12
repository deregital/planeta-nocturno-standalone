import { location } from '@/drizzle/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { createLocationSchema, locationSchema } from '../schemas/location';
import { publicProcedure, router } from '../trpc';

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
  delete: publicProcedure
    .input(locationSchema.shape.id)
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.db.delete(location).where(eq(location.id, input));

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No se encontró la locación',
        });
      }

      return data;
    }),
});
