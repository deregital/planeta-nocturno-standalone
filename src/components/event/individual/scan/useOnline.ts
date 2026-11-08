'use client';

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Si el navegador sabe que no hay red (modo avión, wifi y datos apagados).
 * `true` no garantiza que el servidor responda: eso lo dice cada pedido.
 */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
