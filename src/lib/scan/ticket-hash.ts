/**
 * La tabla del celular está indexada por un hash del id de la entrada, nunca
 * por el id: con la clave del QR y los ids juntos se podrían fabricar QR de
 * todas las entradas del evento. El hash no se revierte.
 *
 * Formato: SHA-256 de `pn-scan-v1:<id en minúsculas>`, primeros 16 bytes, en
 * base64url sin relleno (22 caracteres). El servidor calcula lo mismo con
 * `node:crypto` (`src/server/utils/scanner-crypto.ts`).
 */
export const TICKET_HASH_PREFIX = 'pn-scan-v1:';
export const TICKET_HASH_BYTES = 16;

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function ticketHash(ticketId: string): Promise<string> {
  const data = new TextEncoder().encode(
    TICKET_HASH_PREFIX + ticketId.toLowerCase(),
  );
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest).slice(0, TICKET_HASH_BYTES));
}
