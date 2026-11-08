/**
 * Contrato entre el escáner (celular) y el servidor para el modo de decisión
 * local. Lo importan el router `scanner` y el motor del cliente: no puede
 * depender de nada exclusivo del servidor ni del navegador.
 */

/** Sube cuando cambia la forma de snapshot o sync; el servidor rechaza otras. */
export const SCANNER_PROTOCOL_VERSION = 1;

/**
 * - `off`: como siempre, cada escaneo espera al servidor.
 * - `shadow`: espera al servidor y muestra su respuesta, pero además calcula
 *   la decisión local y registra si coinciden. No cambia nada en la puerta.
 * - `local`: decide en el celular las entradas que conoce y sincroniza por
 *   detrás. Lo que no conoce lo sigue consultando al servidor.
 */
export const SCANNER_MODES = ['off', 'shadow', 'local'] as const;
export type ScannerMode = (typeof SCANNER_MODES)[number];

const MODE_RANK: Record<ScannerMode, number> = { off: 0, shadow: 1, local: 2 };

/** El modo más conservador de los dos. */
export function minMode(a: ScannerMode, b: ScannerMode): ScannerMode {
  return MODE_RANK[a] <= MODE_RANK[b] ? a : b;
}

export function isScannerMode(value: unknown): value is ScannerMode {
  return (
    typeof value === 'string' &&
    (SCANNER_MODES as readonly string[]).includes(value)
  );
}

/**
 * N: cuánto puede pasar el celular sin una foto fresca del servidor (y sin
 * subir sus escaneos) antes de volver a consultar escaneo por escaneo.
 */
export const DEFAULT_MAX_STALE_SECONDS = 60;
export const MIN_MAX_STALE_SECONDS = 10;
export const MAX_MAX_STALE_SECONDS = 300;

export function clampMaxStaleSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STALE_SECONDS;
  return Math.min(
    MAX_MAX_STALE_SECONDS,
    Math.max(MIN_MAX_STALE_SECONDS, Math.round(value)),
  );
}

export type ScannerConfig = {
  mode: ScannerMode;
  maxStaleSeconds: number;
};

export const OFF_CONFIG: ScannerConfig = {
  mode: 'off',
  maxStaleSeconds: DEFAULT_MAX_STALE_SECONDS,
};

/** Con varios eventos en la misma puerta manda el más conservador. */
export function combineConfigs(configs: ScannerConfig[]): ScannerConfig {
  if (configs.length === 0) return OFF_CONFIG;
  return configs.reduce((acc, config) => ({
    mode: minMode(acc.mode, config.mode),
    maxStaleSeconds: Math.min(acc.maxStaleSeconds, config.maxStaleSeconds),
  }));
}

export const MAX_SCANNER_EVENTS = 20;
export const MAX_SYNC_SCANS = 50;

/** Ventana de solapamiento al pedir novedades: cubre transacciones que confirman tarde. */
export const DELTA_OVERLAP_MS = 30_000;

/**
 * Entrada en la tabla del celular, en una tupla para que la bajada pese poco
 * (los ids repetidos se comprimen bien en la respuesta):
 * [hash, evento, tipo, nombre, últimos dígitos del DNI, quien invitó,
 *  escaneada, hora del último escaneo (ISO o null), cantidad de escaneos].
 */
export type SnapshotTicketRow = [
  hash: string,
  eventId: string,
  typeId: string,
  fullName: string,
  dniTail: string,
  invitedBy: string | null,
  scanned: boolean,
  scannedAt: string | null,
  scanCount: number,
];

export type SnapshotTicketType = {
  id: string;
  name: string;
  allowMultipleScans: boolean;
  startingDate: string | null;
  scanLimit: string | null;
};

export type SnapshotEvent = { id: string; name: string };

/** Cambio de estado de una entrada que el celular ya tiene. */
export type DeltaScanRow = [
  hash: string,
  scanned: boolean,
  scannedAt: string | null,
  scanCount: number,
];

/** Resultado del servidor para un escaneo decidido en el celular. */
export type SyncScanOutcome =
  /** Se registró el ingreso. */
  | 'registered'
  /** Ya estaba escaneada por otro escaneo: hubo doble ingreso. */
  | 'duplicate'
  /** La entrada no existe (o no es de estos eventos): se borró o era inválida. */
  | 'not-found';

/** Cuántos dígitos del DNI viajan al celular para mostrar en la tarjeta. */
export const DNI_TAIL_LENGTH = 3;

export function dniTail(dni: string): string {
  const digits = dni.replace(/\D/g, '');
  const source = digits.length > 0 ? digits : dni.trim();
  return source.slice(-DNI_TAIL_LENGTH);
}
