'use client';
import { type FeatureKey } from '@/server/constants/feature-keys';
import { trpc } from '@/server/trpc/client';

export default function FeatureWrapper({
  feature,
  children,
  negate = false,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  negate?: boolean;
}) {
  const { data: isEnabled } = trpc.feature.isEnabledByKey.useQuery(feature);

  const shouldRender = negate ? !isEnabled : isEnabled;

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}
