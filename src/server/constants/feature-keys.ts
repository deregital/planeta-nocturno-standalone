import z from 'zod';

export const FEATURE_KEYS = {
  TICKETERA: 'ticketera',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_CONFIG = {
  [FEATURE_KEYS.TICKETERA]: {
    label: 'Habilitar ticketera',
    validator: z.null(),
  },
} as const satisfies Record<FeatureKey, FeatureConfig>;

export type FeatureConfig = { label: string; validator: z.ZodType };

export type ValueType<Key extends FeatureKey> = z.infer<
  (typeof FEATURE_CONFIG)[Key]['validator']
>;
