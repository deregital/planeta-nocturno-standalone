'use client';

import { WifiOff } from 'lucide-react';
import posthog from 'posthog-js';
import { useCallback, useRef, useState, type ReactNode } from 'react';

import { type EngineEvent } from '@/components/event/individual/scan/local/local-scan-engine';
import { LastScanCard } from '@/components/event/individual/scan/LastScanCard';
import { LastScansHistory } from '@/components/event/individual/scan/LastScansHistory';
import { QRCodeScanner } from '@/components/event/individual/scan/QRCodeScanner';
import {
  CONFLICT_NOTICE_MS,
  INFO_NOTICE_MS,
  MAX_NOTICES,
  ScanNotices,
  type ScanNotice,
} from '@/components/event/individual/scan/ScanNotices';
import { ScannerSettings } from '@/components/event/individual/scan/ScannerSettings';
import { ScannerStatusBar } from '@/components/event/individual/scan/ScannerStatusBar';
import {
  conflictResult,
  scanErrorResult,
  type ScanDisplayResult,
} from '@/components/event/individual/scan/scan-result';
import { useNetwork } from '@/components/event/individual/scan/useNetwork';
import { useScanController } from '@/components/event/individual/scan/useScanController';
import { useScanHistory } from '@/components/event/individual/scan/useScanHistory';
import { historyKey } from '@/lib/scan/scan-history';
import {
  isUnexpectedScanError,
  ScanRequestError,
} from '@/lib/scan/scan-errors';
import { restoredUploadTexts } from '@/lib/scan/scan-texts';
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
  // Cliente directo (sin la cola de react-query): el pedido sale aunque el
  // navegador crea que no hay red, y se puede cortar si queda colgado.
  const utils = trpc.useUtils();
  const [scanInFlight, setScanInFlight] = useState(false);

  const eventIdsRef = useRef(eventIds);
  eventIdsRef.current = eventIds;
  const onlineScan = useCallback(
    async (barcode: string, signal: AbortSignal) => {
      setScanInFlight(true);
      try {
        return await utils.client.emittedTickets.scan.mutate(
          { eventIds: eventIdsRef.current, barcode },
          { signal },
        );
      } finally {
        setScanInFlight(false);
      }
    },
    [utils],
  );
  // Avisos del motor: los resuelve `onEngineEventRef`, que ve el historial
  // de este render.
  const onEngineEventRef = useRef<(event: EngineEvent) => void>(() => {});
  const onEngineEvent = useCallback(
    (event: EngineEvent) => onEngineEventRef.current(event),
    [],
  );
  const controller = useScanController({ eventIds, onlineScan, onEngineEvent });
  const statusRef = useRef(controller.status);
  statusRef.current = controller.status;

  const userId = controller.config?.userId;
  const {
    items: historyItems,
    itemsRef: historyRef,
    add: addToHistory,
    markSync,
  } = useScanHistory(userId ? historyKey(userId, eventIds) : null);
  // La tarjeta grande es solo de lo escaneado en esta sesión: al abrir, una
  // tarjeta vieja confundiría a la puerta (está en el historial).
  const [openedAt] = useState(() => Date.now());
  const lastScan = historyItems.find(
    (item) => item.status !== 'conflict' && (item.at ?? 0) >= openedAt,
  );

  const [notices, setNotices] = useState<ScanNotice[]>([]);
  const showNotice = useCallback((notice: ScanNotice) => {
    setNotices((prev) =>
      [notice, ...prev.filter((n) => n.id !== notice.id)].slice(0, MAX_NOTICES),
    );
  }, []);
  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  onEngineEventRef.current = (event) => {
    if (event.type === 'conflict') {
      const card = conflictResult(event);
      addToHistory(card);
      markSync([event.clientScanId], event.outcome);
      showNotice({
        id: `conflict-${event.clientScanId}`,
        tone: 'warn',
        title: card.text,
        body: card.extraInfo ?? '',
        dni: event.dni,
        autoHideMs: CONFLICT_NOTICE_MS,
      });
    } else if (event.type === 'confirmed') {
      markSync(event.clientScanIds, 'confirmed');
      if (event.restoredIds.length > 0) {
        const restored = new Set(event.restoredIds);
        const names = historyRef.current
          .filter(
            (item) => item.clientScanId && restored.has(item.clientScanId),
          )
          .map((item) => item.ticket?.fullName)
          .filter((name): name is string => !!name);
        const texts = restoredUploadTexts(event.restoredIds.length, names);
        showNotice({
          id: `restored-${event.restoredIds[0]}`,
          tone: 'info',
          title: texts.text,
          body: texts.extraInfo,
          autoHideMs: INFO_NOTICE_MS,
        });
      }
    }
  };

  // Un microcorte no bloquea: el escaneo espera a la red o reintenta (hasta
  // OFFLINE_GRACE_MS). Con más tiempo sin red, solo se escanea si el celular
  // decide solo (modo rápido al día); si no, la cámara no lee y nada queda en
  // espera para registrarse después sin que nadie lo vea.
  const { online, offlineLong } = useNetwork();
  const decidesLocally =
    controller.status.mode === 'local' && controller.status.canDecide;
  const blocked = offlineLong && !decidesLocally;

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
      addToHistory(result);
      return result;
    },
    [controller, addToHistory],
  );

  return (
    <div className='relative'>
      {topLeft && <div className='absolute top-2 left-2 z-10'>{topLeft}</div>}
      <div className='absolute top-2 right-2 z-10 flex gap-2'>
        <ScannerSettings controller={controller} />
        <LastScansHistory lastScans={historyItems} />
      </div>
      <QRCodeScanner
        isLoading={scanInFlight || controller.waitingForNetwork}
        paused={blocked}
        notice={
          blocked
            ? 'Sin conexión'
            : controller.waitingForNetwork
              ? 'Esperando conexión…'
              : undefined
        }
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
        <ScanNotices notices={notices} onDismiss={dismissNotice} />
        {lastScan && <LastScanCard lastScan={lastScan} />}
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
          No se pueden verificar tickets hasta que vuelva la conexión.
          {pending > 0 &&
            ` ${pending} ${pending === 1 ? 'escaneo pendiente se sube' : 'escaneos pendientes se suben'} cuando vuelva.`}
        </p>
      </div>
    </div>
  );
}
