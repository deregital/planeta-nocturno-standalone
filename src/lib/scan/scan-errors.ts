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
 * Manda un escaneo al servidor tolerando microcortes. Sin red espera a que
 * vuelva; si el pedido falla por red, reintenta. Todo dentro de `graceMs`
 * desde el escaneo; pasado el margen, `ScanRequestError` con código claro.
 *
 * Reintentar es seguro: si el primer pedido llegó y se perdió la respuesta,
 * el servidor contesta "ya escaneado" por este usuario (`scannedByMe`) y la
 * puerta lo ve como "Ya registrado" (`retried` permite reconocerlo).
 */
export async function sendWithGrace<T>(
  send: () => Promise<T>,
  deps: {
    isOnline: () => boolean;
    /** Resuelve true si volvió la red antes de `deadline` (ms epoch). */
    waitForOnline: (deadline: number) => Promise<boolean>;
    sleep: (ms: number) => Promise<void>;
    now?: () => number;
    graceMs?: number;
    fallbackReason?: string;
    /** Avisa cuando el escaneo queda esperando a la red (para la pantalla). */
    onWaiting?: (waiting: boolean) => void;
  },
): Promise<{ result: T; retried: boolean }> {
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.graceMs ?? OFFLINE_GRACE_MS);
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
        retried = true;
      }
      try {
        return { result: await send(), retried };
      } catch (error) {
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

const NOT_REGISTERED = 'La entrada no se registró';

/** Título y detalle de la tarjeta de la puerta. */
export function scanErrorTexts(
  code: ScanErrorCode,
  {
    fallbackReason,
    serverMessage,
  }: { fallbackReason?: string; serverMessage?: string } = {},
): { text: string; extraInfo: string } {
  const notInList =
    fallbackReason === 'unknown'
      ? 'Esta entrada no está en la lista del celular. '
      : fallbackReason === 'unreadable'
        ? 'El celular no puede leer este QR por su cuenta. '
        : '';

  switch (code) {
    case 'OFFLINE':
      return {
        text: 'Sin conexión: no se verificó',
        extraInfo: `${notInList}Sin internet no se puede consultar. ${NOT_REGISTERED}: volvé a escanearla cuando vuelva la conexión.`,
      };
    case 'NETWORK':
      return {
        text: 'No se pudo conectar con el servidor',
        extraInfo: `${notInList}${NOT_REGISTERED}. Revisá la conexión y volvé a escanearla.`,
      };
    case 'SESSION_EXPIRED':
      return {
        text: 'Se cerró tu sesión',
        extraInfo: `${NOT_REGISTERED}. Volvé a iniciar sesión para seguir escaneando.`,
      };
    case 'FORBIDDEN':
      return {
        text: 'Sin acceso a este evento',
        extraInfo: `${serverMessage ?? 'Pedile a un administrador que te asigne al evento.'} ${NOT_REGISTERED}.`,
      };
    case 'SERVER':
      return {
        text: 'Error del servidor',
        extraInfo: `${NOT_REGISTERED}. Volvé a escanearla; si se repite, avisá al equipo técnico.`,
      };
    case 'REJECTED':
      return {
        text: 'No se pudo escanear',
        extraInfo: `${serverMessage ? `${serverMessage} ` : ''}${NOT_REGISTERED}.`,
      };
    default:
      return {
        text: 'Error inesperado',
        extraInfo: `${NOT_REGISTERED}. Volvé a escanearla; si se repite, avisá al equipo técnico.`,
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
