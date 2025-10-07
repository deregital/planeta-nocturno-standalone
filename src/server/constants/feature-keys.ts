export const FEATURE_KEYS = {
  DATATABLE_EXPORT: 'datatable-export',
  EMAIL_NOTIFICATION: 'email-notification',
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];
