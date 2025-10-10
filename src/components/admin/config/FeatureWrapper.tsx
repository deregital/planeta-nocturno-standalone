'use client';
import { type FeatureKey } from '@/server/constants/feature-keys';
import { trpc } from '@/server/trpc/client';

export default function FeatureWrapper({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  const { data: isEnabled } = trpc.feature.isEnabledByKey.useQuery(feature);

  if (!isEnabled) {
    return null;
  }

  return <>{children}</>;
}
