'use client';

import { onlineManager } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { type ExternalToast, toast } from 'sonner';

import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export type ScanResult = RouterOutputs['emittedTickets']['scan'];

/** Lo que muestra la tarjeta: una respuesta del servidor o un pedido que no llegó. */
export type ScanEntry =
  | (ScanResult & { barcode: string; at: number })
  | {
      status: 'request-error';
      text: string;
      extraInfo: string;
      ticket: null;
      barcode: string;
      at: number;
    };

const HISTORY_SIZE = 50;

const SCAN_TIMEOUT_MS = 10_000;

const errorOptions: ExternalToast = {
  dismissible: true,
  richColors: true,
  cancel: true,
  duration: 10000,
  position: 'bottom-center',
  icon: <X className='size-4 text-red-500' />,
};

function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

export function useScanSession(eventIds: string[]) {
  const [lastScans, setLastScans] = useState<ScanEntry[]>([]);
  const [isPending, setIsPending] = useState(false);
  const isOnline = useIsOnline();
  // Con el modo por defecto, sin red la mutación quedaba en pausa sin fallar:
  // el scanner ignoraba las lecturas nuevas y la tarjeta seguía mostrando a la
  // persona anterior (a veces en verde).
  const scanMutation = trpc.emittedTickets.scan.useMutation({
    networkMode: 'always',
  });

  const push = (entry: ScanEntry) =>
    setLastScans((prev) => [entry, ...prev].slice(0, HISTORY_SIZE));

  async function scan(barcode: string, force = false): Promise<ScanEntry> {
    setIsPending(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = scanMutation.mutateAsync({ eventIds, barcode, force });
      // Si gana el timeout, que el error tardío no quede sin manejar.
      request.catch(() => {});
      const result = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Sin respuesta del servidor')),
            SCAN_TIMEOUT_MS,
          );
        }),
      ]);
      const entry = { ...result, barcode, at: Date.now() };
      push(entry);
      return entry;
    } catch (error) {
      const offline = !onlineManager.isOnline() || error instanceof TypeError;
      const message =
        error instanceof Error && !offline ? error.message : undefined;
      const entry: ScanEntry = {
        status: 'request-error',
        ticket: null,
        barcode,
        at: Date.now(),
        text: offline
          ? 'Sin conexión: no se registró'
          : 'No se pudo registrar el escaneo',
        extraInfo: offline
          ? 'Volvé a escanear cuando haya señal.'
          : (message ?? 'Volvé a escanear.'),
      };
      push(entry);
      toast.error(entry.text, errorOptions);
      throw error;
    } finally {
      clearTimeout(timeout);
      setIsPending(false);
    }
  }

  return { lastScans, scan, isPending, isOnline };
}

export function OfflineBanner() {
  return (
    <div
      role='alert'
      className='absolute inset-x-0 top-12 z-10 mx-2 rounded-md bg-red-600 px-3 py-2 text-center text-sm font-bold text-white'
    >
      Sin conexión: los escaneos no se registran hasta que vuelva la señal
    </div>
  );
}
