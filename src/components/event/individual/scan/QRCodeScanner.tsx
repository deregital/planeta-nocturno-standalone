'use client';

import { Scanner } from '@yudiel/react-qr-scanner';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

type LastScannedInfo = {
  code: string;
  timestamp: number; // timestamp en milisegundos
};

export function QRCodeScanner({
  onScanSuccessAction,
  isLoading,
}: {
  onScanSuccessAction: (result: string) => Promise<boolean>;
  isLoading: boolean;
}) {
  const [test, setTest] = useState<string | null>(null);
  const isProcessingRef = useRef(false);
  const lastScannedRef = useRef<LastScannedInfo | null>(null);

  async function handleScan(result: string) {
    // Si ya se está procesando una petición, ignorar
    if (isProcessingRef.current) {
      return;
    }

    const now = Date.now();
    const last = lastScannedRef.current;

    // Si es el MISMO QR escaneado exitosamente dentro de 5 segundos, mostrar toast y no procesar
    if (last && last.code === result && now - last.timestamp < 5000) {
      toast.error('Este ticket se acaba de escanear', {
        id: 'scan-error',
      });
    }

    // Marcar como procesando
    isProcessingRef.current = true;

    try {
      const res = await onScanSuccessAction(result);
      setTest(String(res));
      if (res) {
        // Guardar el código y el timestamp del escaneo exitoso
        lastScannedRef.current = {
          code: result,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error('Error al procesar escaneo:', error);
    } finally {
      // Permitir el siguiente escaneo
      isProcessingRef.current = false;
    }
  }

  return (
    <div className='bg-accent-dark transition-opacity'>
      <Scanner
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
        scanDelay={1000}
        formats={['qr_code']}
        onScan={(result) => {
          if (!isLoading && result[0]?.rawValue) {
            handleScan(result[0].rawValue);
          }
        }}
      />
    </div>
  );
}
