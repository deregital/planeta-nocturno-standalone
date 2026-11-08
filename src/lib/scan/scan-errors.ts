import { NOT_REGISTERED_TEXT } from '@/lib/scan/scan-texts';

/**
 * Escaneos que no llegaron a una decisión (sin red, sesión vencida, error del
 * servidor…). Cada uno tiene un código estable para PostHog y un texto para la
 * puerta que dice qué pasó y qué hacer. Ninguno registra la entrada.
 */
export type ScanErrorCode =
  /** El celular no tiene internet: ni se intentó. */
  | 'OFFLINE'
  /** El pedido salió y no volvió (red caída a mitad de camino, servidor inalcanzable). */
  | 'NETWORK'
  /** El pedido salió y no hubo respuesta a tiempo: no se sabe si se registró. */
  | 'TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  /** El servidor respondió con un error propio (500). */
  | 'SERVER'
  /** El servidor rechazó el pedido con un motivo (400, 412, 429…). */
  | 'REJECTED'
  | 'UNKNOWN';

/** Error de un escaneo, ya clasificado. `cause` es el error original. */
export class ScanRequestError extends Error {
  readonly code: ScanErrorCode;
  /** Por qué fue al servidor estando en modo rápido (unknown, unreadable…). */
  readonly fallbackReason?: string;
  /** Mensaje del servidor cuando lo rechazó con un motivo. */
  readonly serverMessage?: string;

  constructor(
    code: ScanErrorCode,
    options: {
      cause?: unknown;
      fallbackReason?: string;
      serverMessage?: string;
    } = {},
  ) {
    super(`Scan request failed: ${code}`, { cause: options.cause });
    this.name = 'ScanRequestError';
    this.code = code;
    this.fallbackReason = options.fallbackReason;
    this.serverMessage = options.serverMessage;
  }
}

type ErrorLike = {
  name?: string;
  message?: string;
  data?: { code?: string; httpStatus?: number } | null;
};

/**
 * Clasifica el error de un pedido de tRPC. Un `TRPCClientError` sin `data` no
 * tuvo respuesta del servidor: es un problema de red.
 */
export function classifyRequestError(
  error: unknown,
  { online }: { online: boolean },
): { code: ScanErrorCode; serverMessage?: string } {
  if (error instanceof ScanRequestError) {
    return { code: error.code, serverMessage: error.serverMessage };
  }
  if (!online) return { code: 'OFFLINE' };
  const e = (error ?? {}) as ErrorLike;
  const trpcCode = e.data?.code;
  if (!trpcCode) {
    const network =
      e.name === 'TRPCClientError' ||
      e.name === 'TypeError' ||
      e.name === 'AbortError';
    return { code: network ? 'NETWORK' : 'UNKNOWN' };
  }
  if (trpcCode === 'UNAUTHORIZED') return { code: 'SESSION_EXPIRED' };
  if (trpcCode === 'FORBIDDEN') {
    return { code: 'FORBIDDEN', serverMessage: e.message };
  }
  if (
    trpcCode === 'INTERNAL_SERVER_ERROR' ||
    (e.data?.httpStatus ?? 0) >= 500
  ) {
    return { code: 'SERVER' };
  }
  return { code: 'REJECTED', serverMessage: e.message };
}

/**
 * Margen para microcortes: hasta acá un escaneo espera a que vuelva la red (o
 * reintenta), y la pantalla no se bloquea por estar sin conexión.
 */
export const OFFLINE_GRACE_MS = 10_000;
/** Espera entre reintentos cuando el pedido falla por red. */
export const NETWORK_RETRY_MS = 1_000;
/**
 * Tope para tener una decisión desde que se leyó el QR. Un pedido colgado
 * (2G, red que se cayó a mitad de camino) se corta acá: la puerta no queda
 * esperando lo que tarde el navegador en darlo por perdido.
 */
export const SCAN_TIMEOUT_MS = 12_000;

const TIMED_OUT = 'scan-timeout';

function scheduleTimeout(run: () => void, ms: number) {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
}

/**
 * Manda un escaneo al servidor tolerando microcortes. Sin red espera a que
 * vuelva; si el pedido falla por red, reintenta. Todo dentro de `graceMs`
 * desde el escaneo; pasado el margen, `ScanRequestError` con código claro.
 * Un pedido que no responde se corta a los `timeoutMs` desde el escaneo
 * (TIMEOUT): `send` recibe la señal y tiene que pasársela al pedido.
 *
 * Reintentar es seguro: si un pedido llegó y se perdió la respuesta, el
 * servidor contesta "ya escaneado" por este usuario (`scannedByMe`) y la
 * puerta lo ve como "Ya registrado" (`retried` permite reconocerlo). Esperar
 * a la red antes del primer envío no es un reintento: nada salió todavía.
 */
export async function sendWithGrace<T>(
  send: (signal: AbortSignal) => Promise<T>,
  deps: {
    isOnline: () => boolean;
    /** Resuelve true si volvió la red antes de `deadline` (ms epoch). */
    waitForOnline: (deadline: number) => Promise<boolean>;
    sleep: (ms: number) => Promise<void>;
    now?: () => number;
    graceMs?: number;
    timeoutMs?: number;
    /** Programa el corte por tiempo; devuelve cómo cancelarlo (para pruebas). */
    schedule?: (run: () => void, ms: number) => () => void;
    fallbackReason?: string;
    /** Avisa cuando el escaneo queda esperando a la red (para la pantalla). */
    onWaiting?: (waiting: boolean) => void;
  },
): Promise<{ result: T; retried: boolean }> {
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const deadline = startedAt + (deps.graceMs ?? OFFLINE_GRACE_MS);
  const timeoutAt = startedAt + (deps.timeoutMs ?? SCAN_TIMEOUT_MS);
  const schedule = deps.schedule ?? scheduleTimeout;
  let retried = false;
  const fail = (code: ScanErrorCode, cause?: unknown, serverMessage?: string) =>
    new ScanRequestError(code, {
      cause,
      fallbackReason: deps.fallbackReason,
      serverMessage,
    });

  try {
    for (;;) {
      if (!deps.isOnline()) {
        deps.onWaiting?.(true);
        if (!(await deps.waitForOnline(deadline))) throw fail('OFFLINE');
      }
      const controller = new AbortController();
      const cancelTimeout = schedule(
        () => controller.abort(TIMED_OUT),
        Math.max(0, timeoutAt - now()),
      );
      try {
        return { result: await send(controller.signal), retried };
      } catch (error) {
        if (controller.signal.reason === TIMED_OUT)
          throw fail('TIMEOUT', error);
        const classified = classifyRequestError(error, {
          online: deps.isOnline(),
        });
        const transient =
          classified.code === 'NETWORK' || classified.code === 'OFFLINE';
        if (!transient || now() + NETWORK_RETRY_MS >= deadline) {
          throw fail(classified.code, error, classified.serverMessage);
        }
        deps.onWaiting?.(true);
        retried = true;
        if (deps.isOnline()) await deps.sleep(NETWORK_RETRY_MS);
      } finally {
        cancelTimeout();
      }
    }
  } finally {
    deps.onWaiting?.(false);
  }
}

/** Errores que no deberían pasar: van a Error Tracking de PostHog. */
export function isUnexpectedScanError(code: ScanErrorCode) {
  return code === 'SERVER' || code === 'UNKNOWN';
}

/**
 * Por qué el celular tuvo que preguntarle al servidor (modo rápido), en
 * palabras de la puerta: qué puede ser ese ticket.
 */
function whyServerNeeded(fallbackReason?: string) {
  switch (fallbackReason) {
    case 'unknown':
      return 'Este celular no tiene este ticket: puede ser de otro evento, recién emitido, eliminado o falso. ';
    case 'unreadable':
      return 'El QR no es de un ticket: puede ser falso o de otro sistema. ';
    default:
      return '';
  }
}

/** Título y detalle de la tarjeta de la puerta. */
export function scanErrorTexts(
  code: ScanErrorCode,
  {
    fallbackReason,
    serverMessage,
  }: { fallbackReason?: string; serverMessage?: string } = {},
): { text: string; extraInfo: string } {
  const why = whyServerNeeded(fallbackReason);

  switch (code) {
    case 'OFFLINE':
      return {
        text: 'Sin conexión: ticket no verificado',
        extraInfo: `${why}${NOT_REGISTERED_TEXT}: que espere y volvé a escanearlo cuando vuelva la conexión.`,
      };
    case 'NETWORK':
      return {
        text: 'No se pudo conectar con el servidor',
        extraInfo: `${why}${NOT_REGISTERED_TEXT}: revisá la conexión y volvé a escanearlo.`,
      };
    case 'TIMEOUT':
      return {
        text: 'El servidor no respondió a tiempo',
        extraInfo: `${why}No se sabe si se registró: volvé a escanearlo. Si ya había entrado por este celular, aparece como "Ya registrado".`,
      };
    case 'SESSION_EXPIRED':
      return {
        text: 'Se cerró tu sesión',
        extraInfo: `${NOT_REGISTERED_TEXT}. Volvé a iniciar sesión para seguir escaneando.`,
      };
    case 'FORBIDDEN':
      return {
        text: 'Sin acceso a este evento',
        extraInfo: `${serverMessage ?? 'Pedile a un administrador que te asigne al evento.'} ${NOT_REGISTERED_TEXT}.`,
      };
    case 'SERVER':
      return {
        text: 'Error del servidor',
        extraInfo: `${NOT_REGISTERED_TEXT}. Volvé a escanearlo; si se repite, avisá al equipo técnico.`,
      };
    case 'REJECTED':
      return {
        text: 'No se pudo escanear',
        extraInfo: `${serverMessage ? `${serverMessage} ` : ''}${NOT_REGISTERED_TEXT}.`,
      };
    default:
      return {
        text: 'Error inesperado',
        extraInfo: `${NOT_REGISTERED_TEXT}. Volvé a escanearlo; si se repite, avisá al equipo técnico.`,
      };
  }
}

/** Mensaje para acciones que no son un escaneo (por ejemplo, cambiar el modo). */
export function requestErrorMessage(
  error: unknown,
  { online, action }: { online: boolean; action: string },
) {
  const { code, serverMessage } = classifyRequestError(error, { online });
  switch (code) {
    case 'OFFLINE':
    case 'NETWORK':
      return `Sin conexión: no se pudo ${action}. Probá de nuevo cuando vuelva la red.`;
    case 'SESSION_EXPIRED':
      return 'Se cerró tu sesión: volvé a iniciar sesión.';
    case 'FORBIDDEN':
    case 'REJECTED':
      return serverMessage ?? `No se pudo ${action}.`;
    default:
      return `No se pudo ${action}. Probá de nuevo; si se repite, avisá al equipo técnico.`;
  }
}
