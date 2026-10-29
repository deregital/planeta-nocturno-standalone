'use client';

import {
  type IDetectedBarcode,
  type IScannerComponents,
  type IScannerProps,
  Scanner,
} from '@yudiel/react-qr-scanner';
import { Check, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SCAN_BEEP } from '@/components/event/individual/scan/scan-beep';
import {
  scanRequestErrorCode,
  useScannerTelemetry,
} from '@/components/event/individual/scan/useScannerTelemetry';
import { type RouterOutputs } from '@/server/routers/app';

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
  | 'error'
  | 'server-error'
  | 'duplicate'
  | 'already-scanned'
  | 'too-early';

export function QRCodeScanner({
  onScanSuccessAction,
  isLoading,
}: {
  onScanSuccessAction: (
    result: string,
  ) => Promise<RouterOutputs['emittedTickets']['scan']>;
  isLoading: boolean;
}) {
  const telemetry = useScannerTelemetry();
  const [feedback, setFeedback] = useState<ScanFeedback>('idle');
  const isProcessingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(
    null,
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beepRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    beepRef.current = new Audio(SCAN_BEEP);
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  function playBeep() {
    const beep = beepRef.current;
    if (!beep) return;
    beep.currentTime = 0;
    // El navegador puede bloquearlo si no hubo interacción con la página.
    beep.play().catch(() => {});
  }

  function scheduleFeedbackReset() {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 2000);
  }

  async function handleScan(result: string) {
    if (isLoading || isProcessingRef.current) return;

    const current = lastScannedRef.current;
    if (
      current &&
      current.code === result &&
      Date.now() - current.timestamp < 5000
    )
      return;

    isProcessingRef.current = true;
    lastScannedRef.current = { code: result, timestamp: Date.now() };
    playBeep();
    const startedAt = performance.now();

    try {
      const res = await onScanSuccessAction(result);
      if (res.status === 'success') {
        setFeedback('success');
      } else {
        setFeedback(res.status as ScanFeedback);
      }
      telemetry.trackScan({
        outcome: res.status,
        startedAt,
        eventId: res.ticket?.eventId,
        serverMs: res.serverMs,
      });
    } catch (error) {
      setFeedback('server-error');
      console.error('Error al procesar escaneo:', error);
      telemetry.trackScan({
        outcome: 'request-error',
        startedAt,
        errorCode: scanRequestErrorCode(error),
      });
    } finally {
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
            opacity: isLoading ? 0.2 : 1,
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
            : feedback !== 'idle'
              ? 'bg-red-500/60'
              : ''
        }`}
      >
        {feedback === 'success' && (
          <Check className='size-32 text-white zoom-in' strokeWidth={3} />
        )}
        {feedback !== 'success' && feedback !== 'idle' && (
          <X className='size-32 text-white zoom-in' strokeWidth={3} />
        )}
      </div>
      {/* Debug */}
      {/* <span className='absolute bottom-0 right-0 text-fuchsia-500 text-lg'>
        {feedback}
      </span> */}
    </div>
  );
}
