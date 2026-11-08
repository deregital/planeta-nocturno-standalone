'use client';

import { WifiOff } from 'lucide-react';
import posthog from 'posthog-js';
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import { ScannerSettings } from '@/components/event/individual/scan/ScannerSettings';
import { ScannerStatusBar } from '@/components/event/individual/scan/ScannerStatusBar';
import {
  scanErrorResult,
  type ScanDisplayResult,
} from '@/components/event/individual/scan/scan-result';
import { useOnline } from '@/components/event/individual/scan/useOnline';
import { useScanController } from '@/components/event/individual/scan/useScanController';
import {
  isUnexpectedScanError,
  ScanRequestError,
} from '@/lib/scan/scan-errors';
import { trpc } from '@/server/trpc/client';

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
    // el pedido salga y, si falla, se vea el error (lo arma `onScanSuccessAction`).
    networkMode: 'always',
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

  // Sin red, solo se puede escanear si el celular decide solo (modo rápido al
  // día). Si no, la cámara no lee: nada queda en espera para registrarse
  // después sin que nadie lo vea.
  const online = useOnline();
  const decidesLocally =
    controller.status.mode === 'local' && controller.status.canDecide;
  const blocked = !online && !decidesLocally;

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

  const onScan = useCallback(
    async (raw: string) => {
      let result: ScanDisplayResult;
      try {
        result = await controller.scan(raw);
      } catch (error) {
        const scanError =
          error instanceof ScanRequestError
            ? error
            : new ScanRequestError('UNKNOWN', { cause: error });
        result = scanErrorResult(scanError, statusRef.current.mode);
        // Lo esperable (sin red, sesión, permisos) queda en
        // `ticket_scan_completed` con `error_code`; lo que no debería pasar
        // va además a Error Tracking con el error original.
        if (isUnexpectedScanError(scanError.code)) {
          posthog.captureException(scanError.cause ?? scanError, {
            scanner_error_code: scanError.code,
            scanner_mode: statusRef.current.mode,
            fallback_reason: scanError.fallbackReason ?? null,
            event_ids: eventIdsRef.current.join(','),
          });
        }
      }
      setLastScans((prev) => [result, ...prev].slice(0, 20));
      return result;
    },
    [controller],
  );

  return (
    <div className='relative'>
      {topLeft && <div className='absolute top-2 left-2 z-10'>{topLeft}</div>}
      <div className='absolute top-2 right-2 z-10 flex gap-2'>
        <ScannerSettings controller={controller} />
        <LastScansHistory lastScans={lastScans} />
      </div>
      <QRCodeScanner
        isLoading={scanMutation.isPending}
        paused={blocked}
        mode={controller.status.mode}
        getHealthExtra={getHealthExtra}
        onScanSuccessAction={onScan}
      />
      <div className='p-4 w-full h-full flex flex-col gap-3'>
        {blocked ? (
          <OfflineNotice pending={controller.status.pending} />
        ) : (
          <ScannerStatusBar controller={controller} online={online} />
        )}
        {lastScans.length > 0 && <LastScanCard lastScan={lastScans[0]} />}
      </div>
    </div>
  );
}

function OfflineNotice({ pending }: { pending: number }) {
  return (
    <div
      role='alert'
      className='flex items-start gap-2 rounded-xl bg-amber-100 px-3 py-2 text-amber-900'
    >
      <WifiOff className='mt-0.5 size-5 shrink-0' />
      <div className='text-sm'>
        <p className='font-bold'>Sin conexión a internet</p>
        <p>
          No se pueden verificar entradas hasta que vuelva la conexión.
          {pending > 0 &&
            ` ${pending} ${pending === 1 ? 'escaneo pendiente se sube' : 'escaneos pendientes se suben'} cuando vuelva.`}
        </p>
      </div>
    </div>
  );
}
