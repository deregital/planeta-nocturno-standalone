import {
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
    /** No hubo decisión: sin red, sesión vencida, error del servidor. */
    | 'error'
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
    // El celular solo tiene los últimos dígitos.
    dni: `…${ticket.dniTail}`,
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
  updated: LocalTicket,
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
