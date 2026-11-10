'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { type ScanDisplayResult } from '@/components/event/individual/scan/scan-result';
import {
  addToHistory,
  markSynced,
  mergeHistory,
  parseHistory,
  type SyncState,
} from '@/lib/scan/scan-history';

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string | null, items: ScanDisplayResult[]) {
  if (!key) return;
  try {
    // El QR no se guarda: es la entrada misma, y sólo sirve para "Dejar
    // pasar igual" mientras la tarjeta está en pantalla.
    localStorage.setItem(
      key,
      JSON.stringify(items.map(({ barcode: _barcode, ...item }) => item)),
    );
  } catch {
    // Sin almacenamiento (modo privado, lleno): el historial queda en memoria.
  }
}

/**
 * Historial de la puerta guardado en el celular (`key` null hasta saber el
 * usuario). Ver `@/lib/scan/scan-history`.
 */
export function useScanHistory(key: string | null) {
  const [items, setItems] = useState<ScanDisplayResult[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keyRef = useRef<string | null>(null);
  /** Lo que dijo el servidor, también de lo que todavía no se cargó. */
  const outcomesRef = useRef(new Map<string, SyncState>());

  const commit = useCallback(
    (update: (prev: ScanDisplayResult[]) => ScanDisplayResult[]) => {
      setItems((prev) => {
        const next = update(prev);
        if (next !== prev) writeStored(keyRef.current, next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!key) return;
    const switched = keyRef.current !== null && keyRef.current !== key;
    keyRef.current = key;
    const stored = parseHistory<ScanDisplayResult>(readStored(key), Date.now());
    commit((prev) =>
      markSynced(
        mergeHistory(switched ? [] : prev, stored),
        outcomesRef.current,
      ),
    );
  }, [key, commit]);

  const add = useCallback(
    (item: ScanDisplayResult) =>
      commit((prev) =>
        addToHistory(prev, { ...item, at: item.at ?? Date.now() }),
      ),
    [commit],
  );

  const markSync = useCallback(
    (clientScanIds: string[], sync: SyncState) => {
      for (const id of clientScanIds) outcomesRef.current.set(id, sync);
      commit((prev) => markSynced(prev, outcomesRef.current));
    },
    [commit],
  );

  return { items, itemsRef, add, markSync };
}
