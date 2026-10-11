import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { location } from '@/drizzle/schema';
import {
  createLocationSchema,
  locationSchema,
  updateLocationSchema,
} from '@/server/schemas/location';
import { permissionProcedure, publicProcedure, router } from '@/server/trpc';

export const locationRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.query.location.findMany();
    if (!data) throw new Error('Locaciones no encontradas');

    return data;
  }),
  getById: publicProcedure
    .input(locationSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const data = ctx.db.query.location.findFirst({
        where: eq(location.id, input),
      });

      if (!data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Locación no encontrada',
        });
      }

      return data;
    }),
  create: permissionProcedure('locations:create')
    .input(createLocationSchema)
    .mutation(async ({ input, ctx }) => {
      const [data] = await ctx.db.insert(location).values(input).returning();

      if (!data) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se pudo crear la locación',
        });
      }

      return data;
    }),
  delete: permissionProcedure('locations:delete')
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
  update: permissionProcedure('locations:update')
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
