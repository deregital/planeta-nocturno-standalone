'use client';

import { X } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { type ExternalToast, toast } from 'sonner';

import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { ScannerSettings } from '@/components/event/individual/scan/ScannerSettings';
import { ScannerStatusBar } from '@/components/event/individual/scan/ScannerStatusBar';
import { type ScanDisplayResult } from '@/components/event/individual/scan/scan-result';
import { useScanController } from '@/components/event/individual/scan/useScanController';
import { trpc } from '@/server/trpc/client';

const errorOptions: ExternalToast = {
  dismissible: true,
  richColors: true,
  cancel: true,
  duration: 10000,
  position: 'bottom-center',
  icon: <X className='size-4 text-red-500' />,
};

/**
 * Pantalla de escaneo con cámara (un evento o varios a la vez). Con el modo
 * del evento apagado se comporta como siempre: cada escaneo espera al
 * servidor. Ver `useScanController` para los modos sombra y rápido.
 */
export function ScannerScreen({
  eventIds,
  topLeft,
}: {
  eventIds: string[];
  topLeft?: ReactNode;
}) {
  const [lastScans, setLastScans] = useState<ScanDisplayResult[]>([]);
  const scanMutation = trpc.emittedTickets.scan.useMutation({
    // Nunca pausar en silencio porque el navegador cree que no hay red: que
    // el pedido salga y, si falla, se vea el error.
    networkMode: 'always',
    onError: (error) => {
      toast.error(`${error.message}`, { ...errorOptions });
    },
  });

  const mutateRef = useRef(scanMutation.mutateAsync);
  mutateRef.current = scanMutation.mutateAsync;
  const eventIdsRef = useRef(eventIds);
  eventIdsRef.current = eventIds;
  const onlineScan = useCallback(
    (barcode: string) =>
      mutateRef.current({ eventIds: eventIdsRef.current, barcode }),
    [],
  );
  const controller = useScanController({ eventIds, onlineScan });
  const statusRef = useRef(controller.status);
  statusRef.current = controller.status;

  const getHealthExtra = useCallback(() => {
    const status = statusRef.current;
    return {
      mode: status.mode,
      can_decide: status.canDecide,
      stale_reason: status.staleReason,
      pending: status.pending,
      last_sync_age_s:
        status.lastSyncAt === null
          ? null
          : Math.round((Date.now() - status.lastSyncAt) / 1000),
      sync_failures: status.consecutiveFailures,
    };
  }, []);

  return (
    <div className='relative'>
      {topLeft && <div className='absolute top-2 left-2 z-10'>{topLeft}</div>}
      <div className='absolute top-2 right-2 z-10 flex gap-2'>
        <ScannerSettings controller={controller} />
        <LastScansHistory lastScans={lastScans} />
      </div>
      <QRCodeScanner
        isLoading={scanMutation.isPending}
        mode={controller.status.mode}
        getHealthExtra={getHealthExtra}
        onScanSuccessAction={async (raw) => {
          const result = await controller.scan(raw);
          setLastScans((prev) => [result, ...prev].slice(0, 20));
          return result;
        }}
      />
      <div className='p-4 w-full h-full flex flex-col gap-3'>
        <ScannerStatusBar controller={controller} />
        {lastScans.length > 0 && <LastScanCard lastScan={lastScans[0]} />}
      </div>
    </div>
  );
}
