/**
 * Regla de decisión de un escaneo sobre una entrada conocida. Es la misma que
 * aplica el servidor (`emittedTickets.scan` + el UPDATE atómico de
 * `tryRegisterTicketScan`): una entrada ya escaneada solo vuelve a entrar si
 * su tipo permite multiescaneo, y fuera del horario de su tipo de entrada se
 * avisa sin registrar, salvo que la puerta la deje pasar igual (`force`).
 */
export type KnownTicketState = {
  scanned: boolean;
  scanCount: number;
};

/** Horario de escaneo de un tipo de entrada (ISO o null si no tiene). */
export type ScanWindow = {
  startingDate: string | null;
  scanLimit: string | null;
};

export type OutOfWindowStatus = 'too-early' | 'expired';

/** Estados de una entrada fuera de horario: se avisa, no se registra. */
export const OUT_OF_WINDOW_STATUSES: ReadonlySet<string> = new Set([
  'too-early',
  'expired',
]);

/** ¿La entrada está fuera de su horario? null si se puede escanear ahora. */
export function scanWindowStatus(
  window: ScanWindow | undefined,
  now: Date,
): OutOfWindowStatus | null {
  if (!window) return null;
  if (window.startingDate && new Date(window.startingDate) > now) {
    return 'too-early';
  }
  if (window.scanLimit && new Date(window.scanLimit) < now) {
    return 'expired';
  }
  return null;
}

export type KnownTicketDecision =
  | { status: 'success'; scanNumber: number }
  | { status: 'already-scanned' }
  | { status: OutOfWindowStatus };

export function decideKnownTicket(
  ticket: KnownTicketState,
  allowMultipleScans: boolean,
  {
    window,
    now = new Date(),
    force = false,
  }: { window?: ScanWindow; now?: Date; force?: boolean } = {},
): KnownTicketDecision {
  if (ticket.scanned && !allowMultipleScans) {
    return { status: 'already-scanned' };
  }
  // Fuera de horario se avisa sin registrar: si se registraba, a la hora
  // correcta ese QR daba 'ya escaneado'.
  const outOfWindow = force ? null : scanWindowStatus(window, now);
  if (outOfWindow) return { status: outOfWindow };
  return { status: 'success', scanNumber: ticket.scanCount + 1 };
}

/** Cuánto vale un reescaneo propio: el mismo celular, la misma entrada. */
export const SELF_REPEAT_WINDOW_MS = 60_000;

/**
 * Resultados de un intento anterior con el mismo QR que permiten reconocer un
 * reescaneo propio: los que no llegaron a mostrar una decisión en la puerta
 * (el pedido quedó en vuelo o falló sin respuesta). Ahí el "ya escaneado" es
 * ese mismo pedido, que llegó al servidor.
 *
 * Si la puerta ya mostró el verde (o "Ya registrado"), una segunda lectura del
 * mismo QR es otra presentación: puede ser una captura que pasó de mano en
 * mano, así que se rechaza como cualquier "ya escaneado".
 */
export const SELF_REPEAT_ELIGIBLE_OUTCOMES: ReadonlySet<string> = new Set([
  'pending',
  'error',
]);

/** Hora del intento anterior que cuenta para un reescaneo propio, o undefined. */
export function selfRepeatAttemptAt(
  prior: { at: number; outcome: string } | undefined,
  now: number,
): number | undefined {
  if (!prior || !SELF_REPEAT_ELIGIBLE_OUTCOMES.has(prior.outcome)) {
    return undefined;
  }
  return now - prior.at > SELF_REPEAT_WINDOW_MS ? undefined : prior.at;
}

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
