/**
 * Pedidos firmados de Pluto que responden por la instancia entera: en una
 * instancia multi-tenant devuelven todas las productoras, así que se pueden
 * llamar por el dominio raíz (el middleware los deja pasar).
 */
export const PLUTO_INSTANCE_API_PATHS = [
  '/api/pluto/agenda',
  '/api/pluto/night-metrics',
] as const;

/**
 * Cada pedido lleva su `action` dentro del cuerpo firmado: así una firma
 * capturada para un endpoint no sirve para otro.
 */
export const PLUTO_AGENDA_ACTION = 'pluto.agenda.v1';
export const PLUTO_NIGHT_METRICS_ACTION = 'pluto.night-metrics.v1';

export function isPlutoInstanceApiPath(pathname: string) {
  return (PLUTO_INSTANCE_API_PATHS as readonly string[]).includes(
    pathname.replace(/\/+$/, ''),
  );
}
