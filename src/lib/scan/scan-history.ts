/**
 * Historial de escaneos de la puerta, guardado en el celular: sobrevive a
 * cerrar y volver a abrir el escáner, así se ve qué pasó con los ingresos que
 * habían quedado sin subir. Solo los últimos y de las últimas horas, por
 * usuario y eventos.
 */
export const HISTORY_LIMIT = 20;
export const HISTORY_TTL_MS = 12 * 60 * 60_000;

/** Qué dijo el servidor de un ingreso que decidió el celular. */
export type SyncState = 'pending' | 'confirmed' | 'duplicate' | 'not-found';

type HistoryItem = { at?: number; clientScanId?: string; sync?: SyncState };

export function historyKey(userId: string, eventIds: string[]) {
  return `pn-scanner-history:v1:${userId}:${[...new Set(eventIds)].sort().join(',')}`;
}

/** Lo guardado, sin lo vencido ni lo que no tiene forma de escaneo. */
export function parseHistory<T extends HistoryItem>(
  raw: string | null,
  now: number,
): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is T =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as HistoryItem).at === 'number' &&
          now - (item as { at: number }).at < HISTORY_TTL_MS,
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function addToHistory<T>(items: T[], item: T): T[] {
  return [item, ...items].slice(0, HISTORY_LIMIT);
}

/** Lo de esta sesión primero (es más nuevo) y después lo guardado. */
export function mergeHistory<T>(current: T[], stored: T[]): T[] {
  return [...current, ...stored].slice(0, HISTORY_LIMIT);
}

/** Marca los ingresos decididos en el celular con lo que dijo el servidor. */
export function markSynced<T extends HistoryItem>(
  items: T[],
  outcomes: ReadonlyMap<string, SyncState>,
): T[] {
  let changed = false;
  const next = items.map((item) => {
    const sync = item.clientScanId
      ? outcomes.get(item.clientScanId)
      : undefined;
    // Solo los ingresos decididos acá tienen `sync` (no los avisos).
    if (!sync || item.sync === undefined || item.sync === sync) return item;
    changed = true;
    return { ...item, sync };
  });
  return changed ? next : items;
}
