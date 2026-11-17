/**
 * Callback de "Conectar con Talo". Es la URL de redirección que se registra
 * en Talo como partner: una sola para todas las plataformas, así que en
 * multi-tenant vive en el dominio raíz y rebota a la plataforma que conectó.
 */
export const TALO_OAUTH_CALLBACK_PATH = '/api/payments/talo-oauth';

/** Página de la plataforma que termina la conexión con el código de Talo. */
export const TALO_CONNECT_COMPLETE_PATH = '/admin/settings/talo';

/** Resultado de "Conectar con Talo" que muestra la tarjeta de Talo. */
export type TaloConnectResult =
  | 'conectado'
  | 'cancelado'
  | 'vencido'
  | 'rechazado'
  | 'error';
