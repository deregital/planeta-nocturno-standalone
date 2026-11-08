/**
 * Lectura en el celular del QR de siempre: `encryptString(ticket.id)` en
 * `src/server/utils/utils.ts` (AES-256-CBC, IV aleatorio, `IV:cifrado` en
 * base64, clave = SHA-256 de BARCODE_SECRET).
 *
 * Si algo no cierra (otro formato, clave equivocada, relleno inválido) devuelve
 * null y el escaneo sigue por el servidor: el celular nunca rechaza un QR que
 * no pudo leer.
 */
const LEGACY_QR_PATTERN = /^[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLegacyQrFormat(code: string): boolean {
  return LEGACY_QR_PATTERN.test(code);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Importa la clave como no exportable: el código no puede volver a leerla. */
export async function importLegacyQrKey(keyBase64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyBase64);
  if (raw.length !== 32) throw new Error('Clave de QR inválida');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, [
    'decrypt',
  ]);
}

/** Id de la entrada (minúsculas) o null si el QR no se puede leer acá. */
export async function decryptLegacyQr(
  code: string,
  key: CryptoKey,
): Promise<string | null> {
  if (!isLegacyQrFormat(code)) return null;
  const [ivBase64, cipherBase64] = code.split(':');
  try {
    const iv = base64ToBytes(ivBase64);
    const cipher = base64ToBytes(cipherBase64);
    if (iv.length !== 16 || cipher.length === 0 || cipher.length % 16 !== 0) {
      return null;
    }
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      cipher,
    );
    const ticketId = new TextDecoder().decode(plain);
    return UUID_PATTERN.test(ticketId) ? ticketId.toLowerCase() : null;
  } catch {
    return null;
  }
}
