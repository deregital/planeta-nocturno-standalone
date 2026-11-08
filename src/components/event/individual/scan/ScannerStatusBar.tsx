'use client';

import { CloudOff, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

import { type ScanController } from '@/components/event/individual/scan/useScanController';
import { cn } from '@/lib/utils';

function ago(lastSyncAt: number | null, now: number) {
  if (lastSyncAt === null) return null;
  const seconds = Math.max(0, Math.round((now - lastSyncAt) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`;
}

/**
 * Estado del escáner a la vista: en qué modo está, hace cuánto sincronizó y
 * cuántos escaneos falta confirmar. No aparece en modo normal sin pendientes.
 */
export function ScannerStatusBar({
  controller,
  online = true,
}: {
  controller: ScanController;
  /** Sin red el modo rápido sigue decidiendo: se avisa que sube después. */
  online?: boolean;
}) {
  const { status } = controller;
  const [now, setNow] = useState(() => Date.now());
  const visible = status.mode !== 'off' || status.pending > 0;

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const since = ago(status.lastSyncAt, now);
  const pending =
    status.pending > 0
      ? ` · ${status.pending} ${status.pending === 1 ? 'pendiente' : 'pendientes'}`
      : '';
  const foreign =
    status.foreignPending > 0
      ? ` · ${status.foreignPending} de otra sesión`
      : '';

  let tone: 'ok' | 'info' | 'warn' = 'info';
  let icon = <Loader2 className='size-4 animate-spin' />;
  let text: string;

  if (status.mode === 'off') {
    tone = 'warn';
    text = `Subiendo escaneos pendientes${pending}`;
  } else if (status.mode === 'shadow') {
    icon = <ShieldCheck className='size-4' />;
    text =
      status.phase === 'ready'
        ? `Modo sombra · sincronizado hace ${since ?? '—'}`
        : status.phase === 'error'
          ? 'Modo sombra · no se pudo bajar la lista'
          : 'Modo sombra · bajando la lista…';
    if (status.phase === 'error') tone = 'warn';
  } else if (status.canDecide) {
    tone = 'ok';
    icon = <Zap className='size-4' />;
    text = online
      ? `Modo rápido · sincronizado hace ${since ?? '—'}${pending}`
      : `Modo rápido · sin conexión${pending}${status.pending > 0 ? ' (se suben cuando vuelva)' : ''}`;
  } else {
    switch (status.staleReason) {
      case 'loading':
        text = 'Preparando modo rápido…';
        break;
      case 'resync-after-wake':
        text = 'Sincronizando…';
        break;
      case 'not-leader':
        tone = 'warn';
        icon = <CloudOff className='size-4' />;
        text =
          'Hay otra pestaña del escáner abierta: esta funciona en modo normal';
        break;
      case 'storage':
        tone = 'warn';
        icon = <CloudOff className='size-4' />;
        text = 'Este navegador no puede guardar escaneos: modo normal';
        break;
      case 'snapshot-error':
        tone = 'warn';
        icon = <CloudOff className='size-4' />;
        text = 'No se pudo bajar la lista: modo normal (reintentando)';
        break;
      default:
        tone = 'warn';
        icon = <CloudOff className='size-4' />;
        text = `Modo normal · sin sincronizar hace ${since ?? '—'}${pending}`;
    }
  }

  return (
    <div
      role='status'
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium',
        tone === 'ok' && 'bg-green-100 text-green-900',
        tone === 'info' && 'bg-accent-ultra-light text-accent-dark',
        tone === 'warn' && 'bg-amber-100 text-amber-900',
      )}
    >
      {icon}
      <span>
        {text}
        {foreign}
      </span>
    </div>
  );
}
