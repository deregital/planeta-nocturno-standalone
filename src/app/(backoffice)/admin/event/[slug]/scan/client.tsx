'use client';

import { ScannerScreen } from '@/components/event/individual/scan/ScannerScreen';
import { type RouterOutputs } from '@/server/routers/app';

export default function ScanClient({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getPublicBySlug']>;
}) {
  return <ScannerScreen eventIds={[event.id]} />;
}
