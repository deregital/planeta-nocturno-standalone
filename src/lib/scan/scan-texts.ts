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

/** Va en todo lo que la puerta tiene que saber que no quedó registrado. */
export const NOT_REGISTERED_TEXT = 'El escaneo no se registró';
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

/**
 * El servidor no aceptó un escaneo que el celular ya había dado por bueno
 * (modo rápido): el ticket también se escaneó en otra puerta, o lo eliminaron.
 */
export function conflictTexts({
  outcome,
  fullName,
  localAt,
  scannedAt,
  scannedByMe,
  scannedByName,
}: {
  outcome: 'duplicate' | 'not-found';
  fullName: string | null;
  /** Cuándo lo escaneó este celular (ms epoch). */
  localAt: number;
  scannedAt: string | null;
  scannedByMe: boolean;
  scannedByName: string | null;
}): { text: string; extraInfo: string } {
  const title = (label: string) => (fullName ? `${label}: ${fullName}` : label);
  const here = `Escaneado por este celular a las ${formatScanTime(new Date(localAt).toISOString())}`;
  const check = 'Si hace falta revisarlo, avisale a un administrador.';
  if (outcome === 'not-found') {
    return {
      text: title('Ticket eliminado'),
      extraInfo: `${here}, pero el ticket ya no existe: lo eliminaron. ${NOT_REGISTERED_TEXT}. ${check}`,
    };
  }
  const by = scannedByMe
    ? ' por tu usuario en otro celular'
    : scannedByName
      ? ` por ${scannedByName}`
      : ' en otra puerta';
  const when = scannedAt ? ` a las ${formatScanTime(scannedAt)}` : '';
  return {
    text: title('Ticket escaneado dos veces'),
    // Las dos horas, sin decir cuál fue primero: no siempre se sabe.
    extraInfo: `${here} y${by}${when}. Puede ser una copia del ticket o la misma persona escaneada en dos puertas. Quedó registrado un solo escaneo. ${check}`,
  };
}

/** Escaneos que quedaron sin subir de antes y el servidor ya registró. */
export function restoredUploadTexts(count: number, names: string[]) {
  const list =
    names.length === 0
      ? ''
      : names.length === 1
        ? `: ${names[0]}`
        : `: ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return {
    text:
      count === 1
        ? 'Se subió un escaneo pendiente'
        : `Se subieron ${count} escaneos pendientes`,
    extraInfo: list
      ? `${count === 1 ? 'Escaneado' : 'Escaneados'} con éxito${list}.`
      : count === 1
        ? 'Quedó registrado.'
        : 'Quedaron registrados.',
  };
}
