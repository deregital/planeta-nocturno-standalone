import z from 'zod';

import { FEATURE_KEYS, type FeatureKey } from '@/server/constants/feature-keys';

export const featureKeySchema = z.enum(
  Object.values(FEATURE_KEYS) as [FeatureKey, ...FeatureKey[]],
);

export const featureSchema = z.object({
  id: z.uuid(),
  key: featureKeySchema,
  enabled: z.boolean(),
  value: z.string().nullable(),
});

export const updateFeaturesSchema = featureSchema
  .omit({
    id: true,
  })
  .refine(
    (data) => {
      if (data.key === FEATURE_KEYS.SERVICE_FEE && data.value !== null) {
        const numValue = parseFloat(data.value);
        return !isNaN(numValue) && numValue >= 0;
      }
      return true;
    },
    {
      message: 'El cargo por servicio no puede ser negativo',
      path: ['value'],
    },
  )
  .array();

export type FeatureSchema = z.infer<typeof featureSchema>;
