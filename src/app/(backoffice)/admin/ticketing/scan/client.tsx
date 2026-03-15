'use client';

import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { type ExternalToast, toast } from 'sonner';

import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

const errorOptions: ExternalToast = {
  dismissible: true,
  richColors: true,
  cancel: true,
  duration: 10000,
  position: 'bottom-center',
  icon: <X className='size-4 text-red-500' />,
};

export default function ScanMultiClient({ eventIds }: { eventIds: string[] }) {
  const [lastScans, setLastScans] = useState<
    RouterOutputs['emittedTickets']['scan'][]
  >([]);
  const scanMutation = trpc.emittedTickets.scan.useMutation({
    onError: (error) => {
      toast.error(`${error.message}`, {
        ...errorOptions,
      });
    },
  });

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

      <QRCodeScanner
        isLoading={scanMutation.isPending}
        onScanSuccessAction={async (raw) => {
          return await scanMutation
            .mutateAsync({ eventIds, barcode: raw })
            .then((result) => {
              setLastScans((prev) => [result, ...prev].slice(0, 20));
              return result.status;
            });
        }}
      />

      <div className='p-4 w-full h-full'>
        {lastScans.length > 0 && <LastScanCard lastScan={lastScans[0]} />}
      </div>
    </div>
  );
}
