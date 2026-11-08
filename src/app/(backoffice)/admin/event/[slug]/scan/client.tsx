'use client';

import { useMemo, useState } from 'react';

import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import {
  OfflineBanner,
  useScanSession,
} from '@/components/event/individual/scan/useScanSession';
import { type RouterOutputs } from '@/server/routers/app';

export default function ScanClient({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getForScanBySlug']>;
}) {
  const eventIds = useMemo(() => [event.id], [event.id]);
  const { lastScans, scan, isPending, isOnline } = useScanSession(eventIds);
  const [isForcing, setIsForcing] = useState(false);

  return (
    <div className='relative'>
      <div className='absolute top-2 right-2 z-10'>
        <LastScansHistory lastScans={lastScans} />
      </div>
      {!isOnline && <OfflineBanner />}

      <QRCodeScanner
        isLoading={isPending}
        onScanSuccessAction={(raw) => scan(raw)}
      />

      <div className='p-4 w-full h-full'>
        {lastScans.length > 0 && (
          <LastScanCard
            lastScan={lastScans[0]}
            isForcing={isForcing}
            onForce={(barcode) => {
              setIsForcing(true);
              scan(barcode, true)
                .catch(() => {})
                .finally(() => setIsForcing(false));
            }}
          />
        )}
      </div>
    </div>
  );
}
