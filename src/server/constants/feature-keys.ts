import type z from 'zod';

export const FEATURE_KEYS = {
  // EXAMPLE: 'example-feature',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_CONFIG = {
  // [FEATURE_KEYS.EXAMPLE]: {
  //   label: 'Example feature',
  //   validator: z.string(),
  // },
} as const satisfies Record<FeatureKey, FeatureConfig>;

export type FeatureConfig = { label: string; validator: z.ZodType };

export type ValueType<Key extends FeatureKey> = z.infer<
  (typeof FEATURE_CONFIG)[Key]['validator']
>;
