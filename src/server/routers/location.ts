import { location } from '@/drizzle/schema';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import {
  createLocationSchema,
  locationSchema,
  updateLocationSchema,
} from '../schemas/location';
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
          code: 'BAD_REQUEST',
          message: 'Error al intenar eliminar la locación',
        });
      }

      return data;
    }),
  update: publicProcedure
    .input(updateLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const data = await ctx.db
        .update(location)
        .set(input)
        .where(eq(location.id, input.id));

      if (!data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Error al intentar actualizar la locación',
        });
      }

      return data;
    }),
});
