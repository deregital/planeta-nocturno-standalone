'use client';

import posthog from 'posthog-js';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { toast } from 'sonner';

import {
  DEFAULT_DEVICE_PREFS,
  deviceModeCap,
  getDeviceId,
  readDevicePrefs,
  writeDevicePrefs,
  type DevicePrefs,
} from '@/components/event/individual/scan/local/device';
import {
  LocalScanEngine,
  type EngineEvent,
  type EngineStatus,
  type Evaluation,
  type ScannerTransport,
} from '@/components/event/individual/scan/local/local-scan-engine';
import { IndexedDbOutboxStore } from '@/components/event/individual/scan/local/outbox-store';
import {
  fromServer,
  localAlreadyScanned,
  localSuccess,
  selfRepeat,
  type ScanDisplayResult,
  type ServerScanResult,
} from '@/components/event/individual/scan/scan-result';
import { isSelfRepeat, SELF_REPEAT_WINDOW_MS } from '@/lib/scan/decision';
import { OFF_CONFIG } from '@/lib/scan/protocol';
import { ScanRequestError, sendWithGrace } from '@/lib/scan/scan-errors';
import { formatScanTime } from '@/lib/scan/scan-texts';
import { trpc } from '@/server/trpc/client';

const OFF_STATUS: EngineStatus = {
  mode: 'off',
  phase: 'idle',
  canDecide: false,
  staleReason: null,
  pending: 0,
  foreignPending: 0,
  lastSyncAt: null,
  tickets: 0,
  leader: true,
  storageOk: true,
  syncing: false,
  consecutiveFailures: 0,
  lastError: null,
  maxStaleSeconds: OFF_CONFIG.maxStaleSeconds,
};
const getOffStatus = () => OFF_STATUS;
const noopSubscribe = () => () => {};

type NavigatorWithConnection = Navigator & {
  connection?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
};

function isBrowserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** true si vuelve la red antes de `deadline` (ms epoch). */
function waitForOnline(deadline: number) {
  if (isBrowserOnline()) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const finish = (online: boolean) => {
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      resolve(online);
    };
    const onOnline = () => finish(true);
    const timer = setTimeout(
      () => finish(isBrowserOnline()),
      Math.max(0, deadline - Date.now()),
    );
    window.addEventListener('online', onOnline);
  });
}

/** Intentos previos que cuentan para reconocer un reescaneo propio. */
const SELF_ELIGIBLE = new Set(['pending', 'success', 'error', 'self-repeat']);

type Attempt = { at: number; outcome: string };

/** Compara lo que habría decidido el celular con lo que dijo el servidor. */
function shadowComparison(evaluation: Evaluation, server: ServerScanResult) {
  const local =
    evaluation.kind === 'known' ? evaluation.decision.status : evaluation.kind;
  if (
    local === 'unknown' ||
    local === 'unreadable' ||
    local === 'unavailable'
  ) {
    // El celular le habría preguntado al servidor: no decide, no discrepa.
    return { result: 'fallback' as const, local };
  }
  return {
    result:
      local === server.status ? ('agree' as const) : ('disagree' as const),
    local,
  };
}

export function useScanController({
  eventIds,
  onlineScan,
}: {
  eventIds: string[];
  onlineScan: (barcode: string) => Promise<ServerScanResult>;
}) {
  const utils = trpc.useUtils();
  const eventKey = [...new Set(eventIds)].sort().join(',');
  const stableEventIds = useMemo(
    () => (eventKey ? eventKey.split(',') : []),
    [eventKey],
  );

  const configQuery = trpc.scanner.config.useQuery(
    { eventIds: stableEventIds },
    {
      enabled: stableEventIds.length > 0,
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  );
  const config = configQuery.data;
  const serverConfig = config?.available ? config.effective : OFF_CONFIG;
  const serverConfigRef = useRef(serverConfig);
  serverConfigRef.current = serverConfig;

  const [prefs, setPrefsState] = useState<DevicePrefs>(DEFAULT_DEVICE_PREFS);
  useEffect(() => setPrefsState(readDevicePrefs()), []);
  const setPrefs = useCallback((next: DevicePrefs) => {
    writeDevicePrefs(next);
    setPrefsState(next);
  }, []);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => setDeviceId(getDeviceId()), []);

  const transport = useMemo<ScannerTransport>(
    () => ({
      snapshot: (input, { signal }) =>
        utils.client.scanner.snapshot.mutate(input, { signal }),
      sync: (input, { signal }) =>
        utils.client.scanner.sync.mutate(input, { signal }),
    }),
    [utils],
  );

  const onEventRef = useRef<(event: EngineEvent) => void>(() => {});
  onEventRef.current = (event) => {
    if (event.type === 'conflict') {
      const who = event.fullName ?? 'Una entrada';
      toast.warning(
        event.outcome === 'duplicate'
          ? `Doble ingreso: ${who} ya había entrado${event.scannedAt ? ` a las ${formatScanTime(event.scannedAt)}` : ''}`
          : `${who}: la entrada ya no existe en el sistema`,
        { duration: 15_000, position: 'bottom-center', richColors: true },
      );
      posthog.capture('scanner_conflict', {
        outcome: event.outcome,
        scanned_by_me: event.scannedByMe,
      });
    } else if (event.type === 'sync') {
      // Solo las subidas y los errores: las bajadas periódicas serían ruido.
      if (!event.ok || event.pushed > 0) {
        posthog.capture('scanner_sync', {
          ok: event.ok,
          latency_ms: Math.round(event.latencyMs),
          pushed: event.pushed,
          pending_after: event.pendingAfter,
          error_code: event.errorCode ?? null,
        });
      }
    } else {
      posthog.capture('scanner_snapshot', {
        ok: event.ok,
        latency_ms: Math.round(event.latencyMs),
        tickets: event.tickets,
      });
    }
  };

  const userId = config?.userId;
  const [engine, setEngine] = useState<LocalScanEngine | null>(null);
  useEffect(() => {
    if (!userId || !deviceId || stableEventIds.length === 0) return;
    // Se crea aunque el modo esté apagado: así se suben escaneos que hayan
    // quedado pendientes de una sesión anterior.
    const instance = new LocalScanEngine({
      transport,
      store: new IndexedDbOutboxStore(),
      userId,
      eventIds: stableEventIds,
      deviceId,
      onEvent: (event) => onEventRef.current(event),
    });
    setEngine(instance);
    void instance.start(serverConfigRef.current);
    return () => {
      instance.stop();
      setEngine(null);
    };
  }, [userId, deviceId, stableEventIds, transport]);

  const { mode: serverMode, maxStaleSeconds: serverMaxStale } = serverConfig;
  useEffect(() => {
    engine?.setServerConfig({
      mode: serverMode,
      maxStaleSeconds: serverMaxStale,
    });
  }, [engine, serverMode, serverMaxStale]);

  useEffect(() => {
    engine?.setDeviceLimits(deviceModeCap(prefs.mode), prefs.maxStaleSeconds);
  }, [engine, prefs]);

  const status = useSyncExternalStore(
    engine?.subscribe ?? noopSubscribe,
    engine?.getStatus ?? getOffStatus,
    getOffStatus,
  );

  // Una sola pestaña por celular decide en local: dos pestañas con dos tablas
  // dejarían pasar el mismo QR una vez en cada una.
  useEffect(() => {
    if (!engine || status.mode !== 'local') return;
    const locks =
      typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return;
    const controller = new AbortController();
    let release: (() => void) | null = null;
    let granted = false;
    const notGranted = setTimeout(() => {
      if (!granted) engine.setLeader(false);
    }, 800);
    locks
      .request('pn-scanner-local', { signal: controller.signal }, () => {
        granted = true;
        clearTimeout(notGranted);
        engine.setLeader(true);
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {});
    return () => {
      clearTimeout(notGranted);
      controller.abort();
      release?.();
    };
  }, [engine, status.mode]);

  useEffect(() => {
    if (!engine) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') engine.onVisible();
    };
    // Volvió la red o cambió (wifi ↔ datos; `connection` solo existe en
    // Android): subir lo pendiente ya, sin esperar el pedido colgado ni el
    // backoff.
    const onNetwork = () => void engine.onNetworkBack();
    const connection = (navigator as NavigatorWithConnection).connection;
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onNetwork);
    connection?.addEventListener?.('change', onNetwork);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', onNetwork);
      connection?.removeEventListener?.('change', onNetwork);
    };
  }, [engine]);

  const hasPending = status.pending > 0;
  useEffect(() => {
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPending]);

  const attemptsRef = useRef(new Map<string, Attempt>());
  const successByTicketRef = useRef(new Map<string, number>());
  /** Un escaneo espera a que vuelva la red (microcorte). */
  const [waitingForNetwork, setWaitingForNetwork] = useState(false);

  const scan = useCallback(
    async (code: string): Promise<ScanDisplayResult> => {
      const now = Date.now();
      for (const [key, attempt] of attemptsRef.current) {
        if (now - attempt.at > SELF_REPEAT_WINDOW_MS)
          attemptsRef.current.delete(key);
      }
      for (const [key, at] of successByTicketRef.current) {
        if (now - at > SELF_REPEAT_WINDOW_MS)
          successByTicketRef.current.delete(key);
      }

      const prior = attemptsRef.current.get(code);
      const priorAt =
        prior && SELF_ELIGIBLE.has(prior.outcome) ? prior.at : undefined;
      const firstAt = priorAt ?? now;
      attemptsRef.current.set(code, { at: firstAt, outcome: 'pending' });
      const record = (result: ScanDisplayResult, ticketId?: string) => {
        attemptsRef.current.set(code, { at: firstAt, outcome: result.status });
        if (result.status === 'success' && ticketId) {
          successByTicketRef.current.set(ticketId, Date.now());
        }
        return result;
      };

      const mode = engine?.getStatus().mode ?? 'off';
      let fallbackReason: string | undefined;

      if (engine && mode === 'local') {
        if (engine.canDecideLocally()) {
          const evaluation = await engine.evaluate(code);
          if (evaluation.kind === 'known') {
            if (evaluation.decision.status === 'success') {
              try {
                const updated = await engine.commitLocalSuccess(
                  evaluation,
                  code,
                );
                return record(
                  localSuccess(evaluation, updated),
                  evaluation.ticketId,
                );
              } catch {
                fallbackReason = 'storage';
              }
            } else {
              const local = localAlreadyScanned(evaluation);
              const ownAt =
                engine.recentLocalSuccessAt(evaluation.ticketId) ??
                successByTicketRef.current.get(evaluation.ticketId);
              return record(
                ownAt !== undefined
                  ? selfRepeat(local, ownAt, Date.now())
                  : local,
              );
            }
          } else {
            fallbackReason = evaluation.kind;
          }
        } else {
          fallbackReason = engine.getStatus().staleReason ?? 'not-ready';
        }
      }

      const shadowStartedAt = performance.now();
      const shadowEvaluation =
        engine && mode === 'shadow' && engine.getStatus().phase === 'ready'
          ? await engine.evaluate(code)
          : null;
      const shadowMs = performance.now() - shadowStartedAt;

      let server: ServerScanResult;
      let retried = false;
      try {
        // Un microcorte no rompe nada: espera a la red o reintenta hasta
        // OFFLINE_GRACE_MS; después, error claro.
        ({ result: server, retried } = await sendWithGrace(
          () => onlineScan(code),
          {
            isOnline: isBrowserOnline,
            waitForOnline,
            sleep,
            fallbackReason,
            onWaiting: setWaitingForNetwork,
          },
        ));
      } catch (error) {
        attemptsRef.current.set(code, { at: firstAt, outcome: 'error' });
        throw error instanceof ScanRequestError
          ? error
          : new ScanRequestError('UNKNOWN', { cause: error, fallbackReason });
      }

      let result = fromServer(server, mode, fallbackReason);
      const ticketId = server.ticket?.id;
      if (server.status === 'already-scanned' && server.scannedByMe) {
        // Tras un reintento, el "ya escaneado" puede ser el primer pedido,
        // que llegó aunque se perdió la respuesta.
        const ownAt =
          priorAt ??
          (retried ? firstAt : undefined) ??
          (ticketId
            ? (successByTicketRef.current.get(ticketId) ??
              engine?.recentLocalSuccessAt(ticketId))
            : undefined);
        if (
          isSelfRepeat({
            scannedByMe: true,
            serverScannedAt: server.ticket?.scannedAt ?? null,
            firstAttemptAt: ownAt,
            now: Date.now(),
          })
        ) {
          result = selfRepeat(result, ownAt!, Date.now());
        }
      }

      if (engine && ticketId) {
        void engine.applyServerScan(
          ticketId,
          server.status,
          server.ticket?.scannedAt ?? null,
        );
      }

      if (shadowEvaluation) {
        const comparison = shadowComparison(shadowEvaluation, server);
        const engineStatus = engine!.getStatus();
        posthog.capture('scanner_shadow_compared', {
          result: comparison.result,
          local: comparison.local,
          server: server.status,
          fresh: engineStatus.staleReason === null,
          stale_reason: engineStatus.staleReason,
          local_ms: Math.round(shadowMs),
          server_ms: server.serverMs ?? null,
        });
      }

      return record(result, ticketId);
    },
    [engine, onlineScan],
  );

  return {
    scan,
    status,
    waitingForNetwork,
    config,
    configLoading: configQuery.isLoading,
    refetchConfig: configQuery.refetch,
    prefs,
    setPrefs,
    deviceId,
  };
}

export type ScanController = ReturnType<typeof useScanController>;
