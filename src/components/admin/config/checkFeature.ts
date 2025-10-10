import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { feature as featureSchema } from '@/drizzle/schema';
import { type FeatureKey } from '@/server/constants/feature-keys';
import { type FeatureSchema } from '@/server/schemas/feature';

export async function checkFeature<TReturn>(
  featureKey: FeatureKey,
  callback: (value: FeatureSchema['value']) => TReturn,
  negate = false,
) {
  const feature = await db.query.feature.findFirst({
    where: eq(featureSchema.key, featureKey),
    columns: {
      enabled: true,
      value: true,
    },
  });

  const shouldExecute = negate ? !feature?.enabled : feature?.enabled;

  if (shouldExecute) {
    return callback(feature?.value ?? null);
  }
}
