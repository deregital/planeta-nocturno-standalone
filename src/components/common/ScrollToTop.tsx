'use client';

import { useLayoutEffect } from 'react';

/**
 * Lleva la ventana arriba de todo al montarse. Next no siempre resetea el
 * scroll cuando una server action redirige (p. ej. checkout → /tickets/[slug]),
 * y en el celular la página nueva quedaba abierta al fondo.
 */
export default function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  return null;
}
