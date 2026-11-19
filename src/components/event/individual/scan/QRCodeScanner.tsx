'use client';

import {
  type IDetectedBarcode,
  type IScannerComponents,
  type IScannerProps,
  Scanner,
} from '@yudiel/react-qr-scanner';
import { Check, Clock, TriangleAlert, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SCAN_BEEP } from '@/components/event/individual/scan/scan-beep';
import { type ScanDisplayResult } from '@/components/event/individual/scan/scan-result';
import {
  type LastRead,
  markSeen,
  type ScanSound,
  scanSound,
  shouldEvaluateRead,
} from '@/lib/scan/read-gate';
import { STOP_TONES, tonesDataUri } from '@/lib/scan/tones';
import {
  scanRequestErrorCode,
  useScannerTelemetry,
} from '@/components/event/individual/scan/useScannerTelemetry';

// El Scanner reinicia su loop de detección cada vez que cambian `onScan`,
// `sound` o `formats`, y el loop anterior sigue corriendo. Si cambian en cada
// render, cada escaneo suma loops hasta trabar el celular: todo lo que recibe
// tiene que ser estable.
const SCANNER_FORMATS: IScannerProps['formats'] = ['qr_code'];
const SCANNER_COMPONENTS: IScannerComponents = {
  finder: true,
  onOff: true,
  torch: true,
  // Debug
  // tracker: (detectedCodes, ctx) => {
  //   detectedCodes.forEach((code) => {
  //     const { x, y, width, height } = code.boundingBox;
  //     ctx.strokeStyle = 'magenta';
  //     ctx.lineWidth = 2;
  //     ctx.strokeRect(x, y, width, height);
  //   });
  // },
};

type ScanFeedback =
  | 'idle'
  | 'success'
  | 'self-repeat'
  | 'error'
  | 'server-error'
  | 'duplicate'
  | 'already-scanned'
  | 'not-found'
  | 'too-early'
  | 'expired';

/** Fuera de horario: no se registró, pero la puerta puede dejarla pasar. */
const OUT_OF_WINDOW_FEEDBACK = new Set<ScanFeedback>(['too-early', 'expired']);

export function QRCodeScanner({
  onScanSuccessAction,
  isLoading,
  paused = false,
  notice,
  mode = 'off',
  getHealthExtra,
}: {
  onScanSuccessAction: (result: string) => Promise<ScanDisplayResult>;
  isLoading: boolean;
  /** Sin red y sin poder decidir en el celular: la cámara no lee. */
  paused?: boolean;
  /** Cartel sobre la cámara (sin conexión, esperando la red). */
  notice?: string;
  /** Modo del escáner, para la telemetría de los escaneos que fallan. */
  mode?: string;
  getHealthExtra?: () => Record<string, unknown>;
}) {
  const telemetry = useScannerTelemetry(getHealthExtra);
  const [feedback, setFeedback] = useState<ScanFeedback>('idle');
  const isProcessingRef = useRef(false);
  const lastReadRef = useRef<LastRead | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundsRef = useRef<Record<ScanSound, HTMLAudioElement> | null>(null);
  useEffect(() => {
    soundsRef.current = {
      'let-in': new Audio(SCAN_BEEP),
      stop: new Audio(tonesDataUri(STOP_TONES)),
    };
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  /** Un pip si pasa, tres graves si no pasa: la puerta no necesita mirar. */
  function playSound(status: string) {
    const sounds = soundsRef.current;
    if (!sounds) return;
    for (const audio of Object.values(sounds)) audio.pause();
    const audio = sounds[scanSound(status)];
    audio.currentTime = 0;
    // El navegador puede bloquearlo si no hubo interacción con la página.
    audio.play().catch(() => {});
  }

  function scheduleFeedbackReset() {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 2000);
  }

  async function handleScan(result: string) {
    const now = Date.now();
    const evaluate =
      !isLoading &&
      !paused &&
      !isProcessingRef.current &&
      shouldEvaluateRead(lastReadRef.current, result, now);
    // Cada detección cuenta para saber si el QR sigue frente a la cámara.
    markSeen(lastReadRef.current, result, now);
    if (!evaluate) return;

    isProcessingRef.current = true;
    lastReadRef.current = {
      code: result,
      respondedAt: now,
      seenAt: now,
      outcome: null,
    };
    const startedAt = performance.now();
    let outcome = 'server-error';

    try {
      const res = await onScanSuccessAction(result);
      outcome = res.status;
      // 'error': no hubo decisión (sin red, sesión, servidor). No es un rechazo.
      setFeedback(
        res.status === 'error' ? 'server-error' : (res.status as ScanFeedback),
      );
      telemetry.trackScan({
        outcome: res.status === 'error' ? 'request-error' : res.status,
        errorCode: res.errorCode,
        startedAt,
        eventId: res.ticket?.eventId,
        serverMs: res.serverMs,
        mode: res.mode,
        decidedBy: res.decidedBy,
        fallbackReason: res.fallbackReason,
        reclassified: res.reclassified,
      });
    } catch (error) {
      setFeedback('server-error');
      console.error('Error al procesar escaneo:', error);
      telemetry.trackScan({
        outcome: 'request-error',
        startedAt,
        errorCode: scanRequestErrorCode(error),
        mode,
        decidedBy: 'server',
      });
    } finally {
      playSound(outcome);
      // La ventana para no repetir el mismo QR cuenta desde la respuesta: si
      // tardó más que la ventana, la cámara lo volvía a leer apenas llegaba.
      const doneAt = Date.now();
      lastReadRef.current = {
        code: result,
        respondedAt: doneAt,
        seenAt: doneAt,
        outcome,
      };
      scheduleFeedbackReset();
      isProcessingRef.current = false;
    }
  }

  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;
  const onScan = useCallback((result: IDetectedBarcode[]) => {
    if (result[0]?.rawValue) handleScanRef.current(result[0].rawValue);
  }, []);

  return (
    <div className='relative bg-accent-dark'>
      <Scanner
        sound={false}
        components={SCANNER_COMPONENTS}
        classNames={{
          container: 'w-full h-fit my-auto',
          video: 'w-full h-fit my-auto',
        }}
        styles={{
          video: {
            transition: 'opacity 0.2s ease-in-out',
            opacity: isLoading || paused ? 0.2 : 1,
          },
        }}
        allowMultiple
        formats={SCANNER_FORMATS}
        onScan={onScan}
        onError={telemetry.trackError}
      />
      <div
        className={`absolute inset-0 flex items-center justify-center ${
          feedback === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${
          feedback === 'success'
            ? 'bg-green-500/60'
            : feedback === 'self-repeat'
              ? 'bg-sky-500/60'
              : feedback === 'server-error' ||
                  OUT_OF_WINDOW_FEEDBACK.has(feedback)
                ? 'bg-amber-500/70'
                : feedback !== 'idle'
                  ? 'bg-red-500/60'
                  : ''
        }`}
      >
        {(feedback === 'success' || feedback === 'self-repeat') && (
          <Check className='size-32 text-white zoom-in' strokeWidth={3} />
        )}
        {OUT_OF_WINDOW_FEEDBACK.has(feedback) && (
          <Clock className='size-32 text-white zoom-in' strokeWidth={3} />
        )}
        {feedback === 'server-error' && (
          <TriangleAlert
            className='size-32 text-white zoom-in'
            strokeWidth={2.5}
          />
        )}
        {feedback !== 'success' &&
          feedback !== 'self-repeat' &&
          feedback !== 'server-error' &&
          !OUT_OF_WINDOW_FEEDBACK.has(feedback) &&
          feedback !== 'idle' && (
            <X className='size-32 text-white zoom-in' strokeWidth={3} />
          )}
      </div>
      {notice && feedback === 'idle' && (
        <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none text-white'>
          <WifiOff className='size-16' strokeWidth={2.5} />
          <p className='text-xl font-bold'>{notice}</p>
        </div>
      )}
      {/* Debug */}
      {/* <span className='absolute bottom-0 right-0 text-fuchsia-500 text-lg'>
        {feedback}
      </span> */}
    </div>
  );
}
