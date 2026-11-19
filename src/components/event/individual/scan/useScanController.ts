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

import {
  DEFAULT_DEVICE_PREFS,
  deviceModeCap,
  getDeviceId,
  readDevicePrefs,
  writeDevicePrefs,
  type DevicePrefs,
} from '@/components/event/individual/scan/local/device';
import {
  isBrowserOnline,
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
  localOutOfWindow,
  localSuccess,
  selfRepeat,
  withOwnEntryInfo,
  type ScanDisplayResult,
  type ServerScanResult,
} from '@/components/event/individual/scan/scan-result';
import {
  isSelfRepeat,
  SELF_REPEAT_WINDOW_MS,
  selfRepeatAttemptAt,
} from '@/lib/scan/decision';
import { OFF_CONFIG } from '@/lib/scan/protocol';
import { ScanRequestError, sendWithGrace } from '@/lib/scan/scan-errors';
import { trpc } from '@/server/trpc/client';

const OFF_STATUS: EngineStatus = {
  mode: 'off',
  phase: 'idle',
  canDecide: false,
  staleReason: null,
  pending: 0,
  foreignPending: 0,
  otherUserPending: 0,
  lastSyncAt: null,
  tickets: 0,
  leader: false,
  storageOk: true,
  syncing: false,
  consecutiveFailures: 0,
  lastError: null,
  maxStaleSeconds: OFF_CONFIG.maxStaleSeconds,
};
const getOffStatus = () => OFF_STATUS;
const noopSubscribe = () => () => {};

/** Una sola pestaña del celular decide en local. */
const SCANNER_LOCK = 'pn-scanner-local';

type NavigatorWithConnection = Navigator & {
  connection?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    /** wifi / cellular / none… (solo Chrome en Android). */
    type?: string;
  };
};

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
  onEngineEvent,
}: {
  eventIds: string[];
  /**
   * Escaneo online; tiene que pasarle `signal` al pedido para poder cortarlo.
   * `force`: "Dejar pasar igual" una entrada fuera de horario.
   */
  onlineScan: (
    barcode: string,
    signal: AbortSignal,
    force: boolean,
  ) => Promise<ServerScanResult>;
  /** Avisos del motor para la pantalla (doble ingreso, escaneos confirmados). */
  onEngineEvent?: (event: EngineEvent) => void;
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
    onEngineEvent?.(event);
    if (event.type === 'conflict') {
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
    } else if (event.type === 'snapshot') {
      posthog.capture('scanner_snapshot', {
        ok: event.ok,
        latency_ms: Math.round(event.latencyMs),
        tickets: event.tickets,
      });
    }
  };

  const userId = config?.userId;
  const available = config?.available ?? false;
  const [engine, setEngine] = useState<LocalScanEngine | null>(null);
  useEffect(() => {
    if (!userId || !deviceId || stableEventIds.length === 0) return;
    // Se crea aunque el modo esté apagado: así se suben escaneos que hayan
    // quedado pendientes de una sesión anterior, y si la instalación tiene el
    // modo local, se entera cuando lo prendan.
    const instance = new LocalScanEngine({
      transport,
      store: new IndexedDbOutboxStore(),
      userId,
      eventIds: stableEventIds,
      deviceId,
      available,
      onEvent: (event) => onEventRef.current(event),
    });
    setEngine(instance);
    void instance.start(serverConfigRef.current);
    return () => {
      instance.stop();
      setEngine(null);
    };
  }, [userId, deviceId, stableEventIds, transport, available]);

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
  // dejarían pasar el mismo QR una vez en cada una. Hasta que el navegador
  // confirma el lock, ninguna decide; sin Web Locks, tampoco.
  useEffect(() => {
    if (!engine || status.mode !== 'local') return;
    const locks =
      typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) {
      engine.setLeader('unsupported');
      return () => engine.setLeader('unknown');
    }
    let cancelled = false;
    let release: (() => void) | null = null;
    const controller = new AbortController();
    const hold = () => {
      if (cancelled) return Promise.resolve();
      engine.setLeader('leader');
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    locks
      .request(SCANNER_LOCK, { ifAvailable: true }, (lock) => {
        if (lock) return hold();
        if (!cancelled) {
          engine.setLeader('follower');
          // Cuando se cierre la otra pestaña, esta pasa a decidir.
          locks
            .request(SCANNER_LOCK, { signal: controller.signal }, hold)
            .catch(() => {});
        }
        return undefined;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      controller.abort();
      release?.();
      engine.setLeader('unknown');
    };
  }, [engine, status.mode]);

  useEffect(() => {
    if (!engine) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') engine.onVisible();
    };
    // Volvió la red: subir lo pendiente ya, sin esperar el pedido colgado ni
    // el backoff.
    const onOnline = () => void engine.onNetworkBack();
    // Cambió la red (wifi ↔ datos; `connection` solo existe en Android). Chrome
    // también avisa cuando cambia su estimación de velocidad: eso no es otra
    // red y no tiene que cortar una bajada que avanza.
    const connection = (navigator as NavigatorWithConnection).connection;
    let lastType = connection?.type;
    const onConnectionChange = () => {
      const type = connection?.type;
      if (type === undefined || type === lastType) return;
      lastType = type;
      void engine.onNetworkBack();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('online', onOnline);
    connection?.addEventListener?.('change', onConnectionChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('online', onOnline);
      connection?.removeEventListener?.('change', onConnectionChange);
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
    async (
      code: string,
      { force = false }: { force?: boolean } = {},
    ): Promise<ScanDisplayResult> => {
      const now = Date.now();
      for (const [key, attempt] of attemptsRef.current) {
        if (now - attempt.at > SELF_REPEAT_WINDOW_MS)
          attemptsRef.current.delete(key);
      }
      for (const [key, at] of successByTicketRef.current) {
        if (now - at > SELF_REPEAT_WINDOW_MS)
          successByTicketRef.current.delete(key);
      }

      // Solo un intento anterior que no mostró decisión (en vuelo o sin
      // respuesta) cuenta para "Ya registrado": si la puerta ya vio el verde,
      // otra lectura del mismo QR es otra presentación y se rechaza.
      const priorAt = selfRepeatAttemptAt(attemptsRef.current.get(code), now);
      const firstAt = priorAt ?? now;
      attemptsRef.current.set(code, { at: firstAt, outcome: 'pending' });
      const record = (result: ScanDisplayResult, ticketId?: string) => {
        attemptsRef.current.set(code, { at: firstAt, outcome: result.status });
        if (result.status === 'success' && ticketId) {
          successByTicketRef.current.set(ticketId, Date.now());
        }
        return result;
      };
      /** Si la entrada entró por este celular hace poco (cualquier QR suyo). */
      const ownEntryAt = (ticketId: string) =>
        engine?.recentLocalSuccessAt(ticketId) ??
        successByTicketRef.current.get(ticketId);

      const mode = engine?.getStatus().mode ?? 'off';
      let fallbackReason: string | undefined;

      if (engine && mode === 'local') {
        if (engine.canDecideLocally()) {
          const evaluation = await engine.evaluate(code, { force });
          if (evaluation.kind === 'known') {
            const decision = evaluation.decision.status;
            if (decision === 'too-early' || decision === 'expired') {
              // Fuera de horario: se avisa sin registrar, igual que el servidor.
              return record(localOutOfWindow(evaluation, decision));
            }
            if (decision === 'success') {
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
            } else if (priorAt !== undefined) {
              // El intento anterior con este QR quedó sin respuesta: el
              // servidor sabe si lo registró este usuario.
              fallbackReason = 'recheck';
            } else {
              return record(
                withOwnEntryInfo(
                  localAlreadyScanned(evaluation),
                  ownEntryAt(evaluation.ticketId),
                  Date.now(),
                ),
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
          ? await engine.evaluate(code, { force })
          : null;
      const shadowMs = performance.now() - shadowStartedAt;

      let server: ServerScanResult;
      let retried = false;
      try {
        // Un microcorte no rompe nada: espera a la red o reintenta hasta
        // OFFLINE_GRACE_MS; un pedido colgado se corta a SCAN_TIMEOUT_MS.
        ({ result: server, retried } = await sendWithGrace(
          (signal) => onlineScan(code, signal, force),
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
      if (server.status === 'already-scanned') {
        // "Ya registrado" solo si este pedido (reintentado) o un intento
        // anterior sin respuesta llegó al servidor y lo registró este usuario.
        const ownAt = priorAt ?? (retried ? firstAt : undefined);
        if (
          isSelfRepeat({
            scannedByMe: server.scannedByMe,
            serverScannedAt: server.ticket?.scannedAt ?? null,
            firstAttemptAt: ownAt,
            now: Date.now(),
          })
        ) {
          result = selfRepeat(result, ownAt!, Date.now());
        } else if (ticketId) {
          result = withOwnEntryInfo(result, ownEntryAt(ticketId), Date.now());
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
