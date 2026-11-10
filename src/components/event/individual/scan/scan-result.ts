import {
  type EngineEvent,
  type Evaluation,
  type LocalTicket,
} from '@/components/event/individual/scan/local/local-scan-engine';
import { type ScannerMode } from '@/lib/scan/protocol';
import {
  type ScanErrorCode,
  scanErrorTexts,
  type ScanRequestError,
} from '@/lib/scan/scan-errors';
import {
  ALREADY_SCANNED_TEXT,
  alreadyScannedExtraInfo,
  conflictTexts,
  outOfWindowTexts,
  ownEntryInfo,
  SELF_REPEAT_TEXT,
  selfRepeatExtraInfo,
  successScanTexts,
} from '@/lib/scan/scan-texts';
import { type RouterOutputs } from '@/server/routers/app';

export type ServerScanResult = RouterOutputs['emittedTickets']['scan'];

/** Lo que muestra la puerta, venga del servidor o del celular. */
export type ScanDisplayResult = {
  status:
    | 'success'
    | 'already-scanned'
    | 'not-found'
    | 'self-repeat'
    /** Fuera del horario de su tipo de entrada: no se registró. */
    | 'too-early'
    | 'expired'
    /** No hubo decisión: sin red, sesión vencida, error del servidor. */
    | 'error'
    /** Aviso del servidor sobre un ingreso que el celular ya dejó pasar. */
    | 'conflict'
    | string;
  text: string;
  extraInfo?: string;
  ticket: {
    id?: string;
    eventId: string;
    fullName: string;
    dni: string;
    scannedAt: string | null;
    ticketType: { name: string };
    ticketGroup: { event: { name: string }; invitedBy: string };
  } | null;
  serverMs?: number;
  /** Quién decidió: el servidor o el celular. */
  decidedBy: 'server' | 'local';
  mode: ScannerMode;
  /** Por qué fue al servidor estando en modo local. */
  fallbackReason?: string;
  /** "Ya escaneado" que era el propio escaneo de este celular. */
  reclassified?: 'self-repeat';
  /** Con `status: 'error'`: código estable para PostHog (OFFLINE, NETWORK…). */
  errorCode?: ScanErrorCode;
  /** Cuándo se mostró (ms epoch); lo pone el historial. */
  at?: number;
  /** Ingreso decidido en el celular: su escaneo en la cola (clientScanId). */
  clientScanId?: string;
  /** Qué dijo el servidor de un ingreso decidido en el celular. */
  sync?: 'pending' | 'confirmed' | 'duplicate' | 'not-found';
  /** QR leído: para "Dejar pasar igual" una entrada fuera de horario. */
  barcode?: string;
};

/** Tarjeta de un escaneo que no llegó a una decisión. */
export function scanErrorResult(
  error: ScanRequestError,
  mode: ScannerMode,
): ScanDisplayResult {
  return {
    status: 'error',
    ...scanErrorTexts(error.code, {
      fallbackReason: error.fallbackReason,
      serverMessage: error.serverMessage,
    }),
    ticket: null,
    decidedBy: 'server',
    mode,
    fallbackReason: error.fallbackReason,
    errorCode: error.code,
  };
}

export function fromServer(
  result: ServerScanResult,
  mode: ScannerMode,
  fallbackReason?: string,
): ScanDisplayResult {
  return { ...result, decidedBy: 'server', mode, fallbackReason };
}

function displayTicket(
  evaluation: Extract<Evaluation, { kind: 'known' }>,
  ticket: LocalTicket,
): NonNullable<ScanDisplayResult['ticket']> {
  return {
    eventId: ticket.eventId,
    fullName: ticket.fullName,
    dni: ticket.dni,
    scannedAt: ticket.scannedAt,
    ticketType: { name: evaluation.type?.name ?? '-' },
    ticketGroup: {
      event: { name: evaluation.eventName },
      invitedBy: ticket.invitedBy || '-',
    },
  };
}

export function localSuccess(
  evaluation: Extract<Evaluation, { kind: 'known' }>,
  updated: LocalTicket & { clientScanId?: string },
): ScanDisplayResult {
  return {
    status: 'success',
    ...successScanTexts({
      fullName: updated.fullName,
      startingDate: evaluation.type?.startingDate ?? null,
      scanLimit: evaluation.type?.scanLimit ?? null,
      scanNumber: updated.scanCount,
      invitedBy: updated.invitedBy,
    }),
    ticket: displayTicket(evaluation, updated),
    decidedBy: 'local',
    mode: 'local',
    clientScanId: updated.clientScanId,
    sync: 'pending',
  };
}

/** Tarjeta para el historial de un doble ingreso o una entrada anulada. */
export function conflictResult(
  event: Extract<EngineEvent, { type: 'conflict' }>,
): ScanDisplayResult {
  return {
    status: 'conflict',
    ...conflictTexts(event),
    ticket: event.fullName
      ? {
          eventId: '',
          fullName: event.fullName,
          dni: event.dni ?? '-',
          scannedAt: null,
          ticketType: { name: '-' },
          ticketGroup: { event: { name: '-' }, invitedBy: '-' },
        }
      : null,
    decidedBy: 'server',
    mode: 'local',
    clientScanId: event.clientScanId,
  };
}

/** Entrada fuera de horario decidida en el celular: se avisa, no se registra. */
export function localOutOfWindow(
  evaluation: Extract<Evaluation, { kind: 'known' }>,
  status: 'too-early' | 'expired',
): ScanDisplayResult {
  return {
    status,
    ...outOfWindowTexts(status, {
      startingDate: evaluation.type?.startingDate ?? null,
      scanLimit: evaluation.type?.scanLimit ?? null,
    }),
    ticket: displayTicket(evaluation, evaluation.ticket),
    decidedBy: 'local',
    mode: 'local',
  };
}

export function localAlreadyScanned(
  evaluation: Extract<Evaluation, { kind: 'known' }>,
): ScanDisplayResult {
  return {
    status: 'already-scanned',
    text: ALREADY_SCANNED_TEXT,
    extraInfo: alreadyScannedExtraInfo(evaluation.ticket.scannedAt),
    ticket: displayTicket(evaluation, evaluation.ticket),
    decidedBy: 'local',
    mode: 'local',
  };
}

/**
 * "Ya escaneado" de una entrada que entró por este celular hace poco: sigue
 * siendo un rechazo, con el dato para que la puerta reconozca a la persona.
 */
export function withOwnEntryInfo(
  result: ScanDisplayResult,
  ownEntryAt: number | undefined,
  now: number,
): ScanDisplayResult {
  if (ownEntryAt === undefined) return result;
  const own = ownEntryInfo((now - ownEntryAt) / 1000);
  return {
    ...result,
    extraInfo: result.extraInfo ? `${result.extraInfo} · ${own}` : own,
  };
}

/** El mismo celular volvió a leer una entrada que acaba de registrar. */
export function selfRepeat(
  base: Pick<ScanDisplayResult, 'ticket' | 'decidedBy' | 'mode' | 'serverMs'>,
  firstAttemptAt: number,
  now: number,
): ScanDisplayResult {
  return {
    ...base,
    status: 'self-repeat',
    text: SELF_REPEAT_TEXT,
    extraInfo: selfRepeatExtraInfo((now - firstAttemptAt) / 1000),
    reclassified: 'self-repeat',
  };
}
