/**
 * Regla de decisión de un escaneo sobre una entrada conocida. Es la misma que
 * aplica el servidor (`canRegisterScan` + el UPDATE atómico de
 * `tryRegisterTicketScan`): una entrada ya escaneada solo vuelve a entrar si
 * su tipo permite multiescaneo. El horario de inicio y el límite no rechazan.
 */
export type KnownTicketState = {
  scanned: boolean;
  scanCount: number;
};

export type KnownTicketDecision =
  | { status: 'success'; scanNumber: number }
  | { status: 'already-scanned' };

export function decideKnownTicket(
  ticket: KnownTicketState,
  allowMultipleScans: boolean,
): KnownTicketDecision {
  if (ticket.scanned && !allowMultipleScans) {
    return { status: 'already-scanned' };
  }
  return { status: 'success', scanNumber: ticket.scanCount + 1 };
}

/** Cuánto vale un reescaneo propio: el mismo celular, la misma entrada. */
export const SELF_REPEAT_WINDOW_MS = 60_000;

/**
 * ¿El "ya escaneado" que devolvió el servidor es el propio escaneo de este
 * celular? Pasa cuando la respuesta tardó, o se perdió, y la cámara volvió a
 * leer el mismo QR. No alcanza con que sea el mismo usuario (varios celulares
 * comparten login): tiene que haber un intento reciente de este dispositivo y
 * el registro del servidor tiene que caer dentro de esa ventana.
 */
export function isSelfRepeat({
  scannedByMe,
  serverScannedAt,
  firstAttemptAt,
  now,
}: {
  scannedByMe: boolean;
  serverScannedAt: string | null;
  /** Primer intento de este celular sobre esa entrada o ese QR (ms epoch). */
  firstAttemptAt: number | undefined;
  now: number;
}): boolean {
  if (!scannedByMe || !serverScannedAt || firstAttemptAt === undefined) {
    return false;
  }
  if (now - firstAttemptAt > SELF_REPEAT_WINDOW_MS) return false;
  const registeredAt = new Date(serverScannedAt).getTime();
  // Margen por diferencia de reloj entre celular y servidor.
  return registeredAt >= firstAttemptAt - 5_000;
}
