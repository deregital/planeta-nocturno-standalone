'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import {
  OfflineBanner,
  useScanSession,
} from '@/components/event/individual/scan/useScanSession';

export default function ScanMultiClient({ eventIds }: { eventIds: string[] }) {
  const { lastScans, scan, isPending, isOnline } = useScanSession(eventIds);
  const [isForcing, setIsForcing] = useState(false);

  return (
    <div className='relative'>
      <div className='absolute top-2 left-2 z-10'>
        <Link
          href='/admin/ticketing'
          className='flex items-center gap-1 text-white bg-accent/25 hover:bg-accent/40 transition-colors rounded-md px-3 py-2 text-sm font-medium'
        >
          <ArrowLeft className='size-4' />
          Cambiar eventos
        </Link>
      </div>
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
