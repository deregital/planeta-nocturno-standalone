'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { OFFLINE_GRACE_MS } from '@/lib/scan/scan-errors';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Estado de la red según el navegador (modo avión, wifi y datos apagados).
 * `offlineLong`: lleva más de OFFLINE_GRACE_MS sin red seguidos; un microcorte
 * no llega a eso. `online` no garantiza que el servidor responda: eso lo dice
 * cada pedido.
 */
export function useNetwork() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const [offlineLong, setOfflineLong] = useState(false);

  useEffect(() => {
    if (online) {
      setOfflineLong(false);
      return;
    }
    const timer = setTimeout(() => setOfflineLong(true), OFFLINE_GRACE_MS);
    return () => clearTimeout(timer);
  }, [online]);

  return { online, offlineLong: !online && offlineLong };
}
