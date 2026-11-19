import 'server-only';

import { createHash } from 'node:crypto';

import { TICKET_HASH_BYTES, TICKET_HASH_PREFIX } from '@/lib/scan/ticket-hash';
import { getBarcodeKey } from '@/server/utils/utils';

/** Mismo hash que `ticketHash` del cliente, sincrónico para armar tablas grandes. */
export function serverTicketHash(ticketId: string): string {
  return createHash('sha256')
    .update(TICKET_HASH_PREFIX + ticketId.toLowerCase())
    .digest()
    .subarray(0, TICKET_HASH_BYTES)
    .toString('base64url');
}

/**
 * La clave de los QR viaja a los escáneres en modo sombra o local para que
 * puedan leer los QR de siempre sin el servidor. Con la clave sola no se
 * fabrica una entrada: hace falta además el id de una entrada real, y la tabla
 * del celular solo tiene hashes de los ids.
 */
export function getLegacyQrKeyBase64(): string {
  return getBarcodeKey().toString('base64');
}

/**
 * El modo local se habilita por instalación (proyecto de Vercel) con
 * SCANNER_LOCAL_MODE_ENABLED=true. Sin eso, todos los eventos escanean como
 * siempre y la configuración por evento no aparece.
 */
export function isScannerLocalModeAvailable(): boolean {
  return process.env.SCANNER_LOCAL_MODE_ENABLED === 'true';
}
