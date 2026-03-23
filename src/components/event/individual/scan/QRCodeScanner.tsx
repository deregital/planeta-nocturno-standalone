'use client';

import { Scanner } from '@yudiel/react-qr-scanner';
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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
  onScanSuccessAction: (result: string) => Promise<string>;
  isLoading: boolean;
}) {
  const [feedback, setFeedback] = useState<ScanFeedback>('idle');
  const isProcessingRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(
    null,
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  function scheduleFeedbackReset() {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback('idle'), 2000);
  }

  async function handleScan(result: string) {
    if (isProcessingRef.current) return;

    const current = lastScannedRef.current;
    if (
      current &&
      current.code === result &&
      Date.now() - current.timestamp < 5000
    )
      return;

    isProcessingRef.current = true;
    lastScannedRef.current = { code: result, timestamp: Date.now() };

    try {
      const res = await onScanSuccessAction(result);
      if (res === 'success') {
        setFeedback('success');
      } else {
        setFeedback(res as ScanFeedback);
      }
    } catch (error) {
      setFeedback('server-error');
      console.error('Error al procesar escaneo:', error);
    } finally {
      scheduleFeedbackReset();
      isProcessingRef.current = false;
    }
  }

  return (
    <div className='relative bg-accent-dark'>
      <Scanner
        sound={feedback === 'idle' && !isLoading}
        components={{
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
        }}
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
        formats={['qr_code']}
        onScan={(result) => {
          if (!isLoading && result[0]?.rawValue) {
            handleScan(result[0].rawValue);
          }
        }}
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
