import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { feature as featureSchema } from '@/drizzle/schema';
import { FEATURE_KEYS, type FeatureKey } from '@/server/constants/feature-keys';
import { adminProcedure, router } from '@/server/trpc';

const featureKeySchema = z.enum(
  Object.keys(FEATURE_KEYS) as [FeatureKey, ...FeatureKey[]],
);

export const featureRouter = router({
  isEnabledByKey: adminProcedure
    .input(featureKeySchema)
    .query(async ({ ctx, input }) => {
      const feature = await ctx.db.query.feature.findFirst({
        where: eq(featureSchema.key, input),
      });

      if (!feature) return null;

      return feature.enabled;
    }),
});
