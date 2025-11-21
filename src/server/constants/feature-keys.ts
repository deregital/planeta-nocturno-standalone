import z from 'zod';

export const FEATURE_KEYS = {
  EMAIL_NOTIFICATION: 'email-notification',
  SERVICE_FEE: 'service-fee',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_CONFIG = {
  [FEATURE_KEYS.EMAIL_NOTIFICATION]: {
    label: 'Recibir notificaciones de tickets emitidos',
    validator: z.null(),
  },
  [FEATURE_KEYS.SERVICE_FEE]: {
    label: 'Cargo por servicio %',
    validator: z.coerce.number().min(0),
  },
} as const satisfies Record<
  FeatureKey,
  { label: string; validator: z.ZodType }
>;

export type ValueType<Key extends FeatureKey> = z.infer<
  (typeof FEATURE_CONFIG)[Key]['validator']
>;
