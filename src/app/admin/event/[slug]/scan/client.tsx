'use client';

import { type ExternalToast, toast } from 'sonner';
import { X, Check } from 'lucide-react';

import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

const successOptions: ExternalToast = {
  dismissible: true,
  richColors: true,
  cancel: true,
  duration: 10000,
  position: 'bottom-center',
  icon: <Check className='size-4 text-green-500' />,
};

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
              if (result.success) {
                toast.success(`${result.text}\n${result.extraInfo}`, {
                  ...successOptions,
                });
              } else {
                toast.error(`${result.text}\n${result.extraInfo}`, {
                  ...errorOptions,
                });
              }
            });
        }}
      />
    </div>
  );
}
