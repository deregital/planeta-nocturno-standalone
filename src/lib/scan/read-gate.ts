/**
 * Cuándo el lector vuelve a evaluar un QR que ya leyó. La cámara detecta el
 * QR que tiene enfrente muchas veces por segundo, así que hay que distinguir
 * "sigue ahí" de "lo volvieron a mostrar".
 *
 * - Sofía muestra su QR, sale verde y se queda con el celular frente a la
 *   cámara: es la misma presentación. No se vuelve a evaluar (antes, a los 5 s
 *   salía una X roja "ya escaneado" que era ella misma).
 * - Sofía entra y le pasa una captura a Martina, que la muestra después: el
 *   QR dejó de verse y volvió. Se evalúa y da rojo ("entró por este celular").
 */

/** Ventana mínima para no repetir el mismo QR, contada desde la respuesta. */
export const SAME_CODE_WINDOW_MS = 5_000;
/**
 * Si el mismo QR se volvió a detectar hace menos que esto, sigue frente a la
 * cámara (el lector lo ve varias veces por segundo mientras está ahí).
 */
export const STILL_IN_VIEW_MS = 2_000;

/** Resultados después de los cuales la persona pasa: quieto no se reevalúa. */
const LET_IN = new Set(['success', 'self-repeat']);

export type LastRead = {
  code: string;
  /** Cuándo terminó de procesarse (o empezó, mientras se procesa). */
  respondedAt: number;
  /** Última vez que la cámara detectó este QR. */
  seenAt: number;
  /** Lo que mostró la puerta; null mientras se procesa. */
  outcome: string | null;
};

/** ¿Hay que evaluar esta lectura? (Sin efectos: ver `markSeen`.) */
export function shouldEvaluateRead(
  last: LastRead | null,
  code: string,
  now: number,
): boolean {
  if (!last || last.code !== code) return true;
  if (now - last.respondedAt < SAME_CODE_WINDOW_MS) return false;
  // Pasó (verde o "Ya registrado") y nunca dejó de verse: es la misma
  // presentación. Después de un rechazo o un error sí se vuelve a evaluar
  // solo, como siempre (por ejemplo, al volver la red).
  const stillInView = now - last.seenAt < STILL_IN_VIEW_MS;
  return !(stillInView && last.outcome !== null && LET_IN.has(last.outcome));
}

/** Registra que la cámara volvió a ver el QR de la última lectura. */
export function markSeen(last: LastRead | null, code: string, now: number) {
  if (last && last.code === code) last.seenAt = now;
}

/**
 * Sonido del resultado: uno si la persona pasa, otro si no pasa (rechazo,
 * entrada de otro evento o escaneo sin decisión, como sin conexión).
 */
export type ScanSound = 'let-in' | 'stop';

export function scanSound(status: string): ScanSound {
  return LET_IN.has(status) ? 'let-in' : 'stop';
}
