'use client';

import { type ExternalToast, toast } from 'sonner';
import { X } from 'lucide-react';
import { useState } from 'react';

import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';

const errorOptions: ExternalToast = {
  dismissible: true,
  richColors: true,
  cancel: true,
  duration: 10000,
  position: 'bottom-center',
  icon: <X className='size-4 text-red-500' />,
};

export default function ScanClient({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
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
    <div>
      <QRCodeScanner
        isLoading={scanMutation.isPending}
        onScanSuccessAction={async (raw) => {
          await scanMutation
            .mutateAsync({
              eventId: event.id,
              barcode: raw,
            })
            .then((result) => {
              setLastScans([result, ...lastScans]);
            });
        }}
      />
      <div className='p-4 w-full h-full'>
        {lastScans.length > 0 && <LastScanCard lastScan={lastScans[0]} />}
      </div>
    </div>
  );
}
