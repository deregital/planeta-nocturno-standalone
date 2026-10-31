'use client';

import { TRPCClientError } from '@trpc/client';
import posthog from 'posthog-js';
import { useCallback, useEffect, useRef } from 'react';

const HEALTH_INTERVAL_MS = 30_000;
const LAG_PROBE_MS = 1000;

type BrowserNavigator = Navigator & {
  connection?: { effectiveType?: string };
};
type BrowserPerformance = Performance & {
  memory?: { usedJSHeapSize: number };
};

function sessionProperties(scans: number, mountedAt: number) {
  return {
    scans_in_session: scans,
    page_age_s: Math.round((performance.now() - mountedAt) / 1000),
    connection_type: (navigator as BrowserNavigator).connection?.effectiveType,
  };
}

/** Código del error de tRPC, o `NETWORK` si el pedido no llegó al servidor. */
export function scanRequestErrorCode(error: unknown) {
  if (!(error instanceof TRPCClientError)) return 'UNKNOWN';
  return (error.data?.code as string | undefined) ?? 'NETWORK';
}

/**
 * Métricas del scanner en PostHog para seguir la puerta en vivo: un evento por
 * escaneo con su latencia, uno de salud cada 30 s con la demora del hilo
 * principal y los errores de cámara. No manda datos personales del ticket.
 */
export function useScannerTelemetry() {
  const mountedAtRef = useRef(0);
  const scansRef = useRef(0);
  const windowScansRef = useRef(0);

  useEffect(() => {
    mountedAtRef.current = performance.now();

    // Un timer de 1 s que se dispara tarde mide cuánto está bloqueado el hilo
    // principal: es lo que traba la detección y la respuesta del scanner.
    let last = performance.now();
    let lagTotal = 0;
    let lagMax = 0;
    let samples = 0;
    const probe = setInterval(() => {
      const now = performance.now();
      const lag = Math.max(0, now - last - LAG_PROBE_MS);
      last = now;
      // Con la pestaña oculta el navegador frena los timers: no es demora real.
      if (document.hidden) return;
      lagTotal += lag;
      lagMax = Math.max(lagMax, lag);
      samples += 1;
    }, LAG_PROBE_MS);
    const onVisibilityChange = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const report = setInterval(() => {
      if (samples === 0) return;
      const memory = (performance as BrowserPerformance).memory;
      posthog.capture('scanner_health', {
        lag_avg_ms: Math.round(lagTotal / samples),
        lag_max_ms: Math.round(lagMax),
        scans_in_window: windowScansRef.current,
        heap_mb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
        ...sessionProperties(scansRef.current, mountedAtRef.current),
      });
      lagTotal = 0;
      lagMax = 0;
      samples = 0;
      windowScansRef.current = 0;
    }, HEALTH_INTERVAL_MS);

    return () => {
      clearInterval(probe);
      clearInterval(report);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const trackScan = useCallback(
    (scan: {
      outcome: string;
      startedAt: number;
      eventId?: string | null;
      serverMs?: number;
      errorCode?: string;
    }) => {
      scansRef.current += 1;
      windowScansRef.current += 1;
      posthog.capture('ticket_scan_completed', {
        source: 'camera',
        outcome: scan.outcome,
        event_id: scan.eventId ?? null,
        latency_ms: Math.round(performance.now() - scan.startedAt),
        server_ms: scan.serverMs ?? null,
        error_code: scan.errorCode ?? null,
        ...sessionProperties(scansRef.current, mountedAtRef.current),
      });
    },
    [],
  );

  const trackError = useCallback((error: unknown) => {
    posthog.capture('scanner_error', {
      error_name: error instanceof Error ? error.name : typeof error,
      error_message: error instanceof Error ? error.message : String(error),
      ...sessionProperties(scansRef.current, mountedAtRef.current),
    });
  }, []);

  return { trackScan, trackError };
}
