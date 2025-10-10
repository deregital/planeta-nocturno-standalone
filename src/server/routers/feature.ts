import { eq } from 'drizzle-orm';

import { feature as featureSchema } from '@/drizzle/schema';
import {
  featureKeySchema,
  updateFeaturesSchema,
} from '@/server/schemas/feature';
import { adminProcedure, router } from '@/server/trpc';

export const featureRouter = router({
  getAll: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.feature.findMany();
  }),
  getByKey: adminProcedure
    .input(featureKeySchema)
    .query(async ({ ctx, input }) => {
      return await ctx.db.query.feature.findFirst({
        where: eq(featureSchema.key, input),
      });
    }),
  isEnabledByKey: adminProcedure
    .input(featureKeySchema)
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.query.feature.findFirst({
        where: eq(featureSchema.key, input),
      });

      if (!feature) return null;

      return feature.enabled;
    }),
  update: adminProcedure
    .input(updateFeaturesSchema)
    .mutation(async ({ ctx, input }) => {
      const updatedFeatures = await Promise.all(
        input.map(async (feature) => {
          return await ctx.db
            .update(featureSchema)
            .set(feature)
            .where(eq(featureSchema.key, feature.key));
        }),
      );

      return updatedFeatures;
    }),
});
