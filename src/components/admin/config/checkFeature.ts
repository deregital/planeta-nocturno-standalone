import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { feature as featureSchema } from '@/drizzle/schema';
import {
  FEATURE_CONFIG,
  type FeatureKey,
  type ValueType,
} from '@/server/constants/feature-keys';

export async function checkFeature<TReturn, Key extends FeatureKey>(
  featureKey: Key,
  callback: (value: ValueType<Key>) => TReturn,
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

  const validation = FEATURE_CONFIG[featureKey].validator.safeParse(
    feature?.value,
  );

  if (shouldExecute && validation.success) {
    return callback(validation.data as ValueType<Key>);
  }
}
