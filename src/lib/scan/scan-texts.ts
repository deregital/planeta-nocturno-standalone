import { formatInTimeZone } from 'date-fns-tz';

/**
 * Textos del resultado de un escaneo. Los usan el servidor (escaneo online) y
 * el celular (modo local), así la puerta ve lo mismo en los dos caminos.
 */
export const SCAN_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatDateTime(value: string) {
  return formatInTimeZone(new Date(value), SCAN_TIMEZONE, 'dd/MM/yyyy HH:mm');
}

export function formatScanTime(scannedAt: string | null) {
  if (!scannedAt) return '';
  return formatInTimeZone(new Date(scannedAt), SCAN_TIMEZONE, 'HH:mm');
}

export function successScanTexts({
  fullName,
  startingDate,
  scanLimit,
  scanNumber,
  invitedBy,
  now = new Date(),
}: {
  fullName: string;
  startingDate: string | null;
  scanLimit: string | null;
  /** Número de este escaneo (1 la primera vez). */
  scanNumber: number;
  invitedBy: string | null | undefined;
  now?: Date;
}) {
  // El horario de inicio y el límite no rechazan: el ingreso se registra y
  // solo se avisa en la tarjeta (mismo comportamiento que siempre).
  let warning = '';
  if (startingDate && new Date(startingDate) > now) {
    warning = `La hora de inicio del ticket es a las ${formatDateTime(startingDate)}`;
  }
  if (scanLimit && new Date(scanLimit) < now) {
    warning = `Ticket expirado, límite de horario era ${formatDateTime(scanLimit)}`;
  }

  return {
    text: `Escaneado con éxito: ${fullName}`,
    extraInfo:
      `${warning}${scanNumber > 1 ? ` - Escaneo #${scanNumber}` : ''} ${invitedBy ? `- Invitado por ${invitedBy}` : ''}`.trim(),
  };
}

export const ALREADY_SCANNED_TEXT = 'Ticket ya escaneado';

export function alreadyScannedExtraInfo(scannedAt: string | null) {
  return `Escaneado a las ${formatScanTime(scannedAt)}`;
}

export const NOT_FOUND_TEXT = 'Ticket no encontrado';
export const NOT_FOUND_EXTRA_INFO = 'El ticket no pertenece a este evento';

/** El mismo celular volvió a leer una entrada que acaba de registrar. */
export const SELF_REPEAT_TEXT = 'Ya registrado';

export function selfRepeatExtraInfo(secondsAgo: number) {
  const seconds = Math.max(0, Math.round(secondsAgo));
  return seconds < 1
    ? 'Este celular lo registró recién'
    : `Este celular lo registró hace ${seconds} s`;
}

/**
 * Para un "ya escaneado" que entró por este mismo celular hace poco: ayuda a
 * la puerta a reconocer a la persona, sin dejar de ser un rechazo.
 */
export function ownEntryInfo(secondsAgo: number) {
  const seconds = Math.max(0, Math.round(secondsAgo));
  return seconds < 1
    ? 'Entró recién por este celular'
    : `Entró por este celular hace ${seconds} s`;
}
