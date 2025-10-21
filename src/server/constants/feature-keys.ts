import z from 'zod';

export const FEATURE_KEYS = {
  DATATABLE_EXPORT: 'datatable-export',
  EMAIL_NOTIFICATION: 'email-notification',
  SERVICE_FEE: 'service-fee',
  EXTRA_DATA_CHECKOUT: 'extra-data-checkout',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_CONFIG = {
  [FEATURE_KEYS.DATATABLE_EXPORT]: {
    label: 'Exportar tablas a Excel',
    validator: z.null(),
  },
  [FEATURE_KEYS.EMAIL_NOTIFICATION]: {
    label: 'Recibir notificaciones de entradas emitidas',
    validator: z.null(),
  },
  [FEATURE_KEYS.SERVICE_FEE]: {
    label: 'Cargo por servicio %',
    validator: z.coerce.number().min(0),
  },
  [FEATURE_KEYS.EXTRA_DATA_CHECKOUT]: {
    label: 'Pedir datos extra a partir de la segunda entrada',
    validator: z.null(),
  },
} as const satisfies Record<
  FeatureKey,
  { label: string; validator: z.ZodType }
>;

export type ValueType<Key extends FeatureKey> = z.infer<
  (typeof FEATURE_CONFIG)[Key]['validator']
>;
