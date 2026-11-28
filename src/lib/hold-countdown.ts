/** Desde cuánto falta la barra de la reserva se pone en rojo. */
export const HOLD_ENDING_MS = 2 * 60 * 1000;

export type HoldPhase = 'running' | 'ending' | 'expired';

export function holdPhase(remainingMs: number): HoldPhase {
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= HOLD_ENDING_MS) return 'ending';
  return 'running';
}

/** `MM:SS` (o `H:MM:SS` desde una hora), redondeando hacia arriba: no muestra 00:00 antes de vencer. */
export function formatHoldRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}
