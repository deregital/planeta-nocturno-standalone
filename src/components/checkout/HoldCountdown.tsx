'use client';

import { Timer } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  formatHoldRemaining,
  type HoldPhase,
  holdPhase,
} from '@/lib/hold-countdown';
import { cn } from '@/lib/utils';

const ANNOUNCEMENTS: Record<HoldPhase, (task: string) => string> = {
  running: () => '',
  ending: (task) => `Quedan menos de 2 minutos para ${task}.`,
  // El aviso de vencido ya es role='alert'.
  expired: () => '',
};

/**
 * Cuenta regresiva de una reserva. Descuenta con la hora del servidor
 * (`serverNow`, la del render) y no con la del celular, que puede estar
 * corrida: del reloj local sólo usa cuánto tiempo pasó.
 */
export function HoldCountdown({
  expiresAt,
  serverNow,
  task,
  backHref,
  onExpire,
  className,
}: {
  expiresAt: string;
  serverNow: number;
  /** Lo que hay que hacer antes de que venza: "completar tus datos". */
  task: string;
  /** Adónde volver a elegir tickets cuando vence. */
  backHref: Route;
  onExpire?: () => void;
  className?: string;
}) {
  const expiresAtMs = new Date(expiresAt).getTime();
  const [remainingMs, setRemainingMs] = useState(expiresAtMs - serverNow);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    // Lo que el reloj del celular difiere del servidor, medido al montar.
    const skew = serverNow - Date.now();
    const tick = () => {
      const remaining = expiresAtMs - (Date.now() + skew);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onExpireRef.current?.();
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [expiresAtMs, serverNow]);

  const phase = holdPhase(remainingMs);
  const time = formatHoldRemaining(remainingMs);

  return (
    <div className={className} data-hold-countdown={phase}>
      {phase === 'expired' ? (
        <div
          role='alert'
          className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 shadow-sm'
        >
          <span>Se terminó el tiempo y liberamos los tickets.</span>
          <Link href={backHref} className='font-bold underline'>
            Volver a elegir tickets
          </Link>
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm',
            phase === 'ending'
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-accent-light bg-accent-ultra-light text-accent-dark',
          )}
        >
          <Timer className='size-4 shrink-0' aria-hidden />
          <span role='timer' className='min-w-0'>
            {phase === 'ending' ? (
              <>
                Quedan <b className='tabular-nums'>{time}</b> para {task}
              </>
            ) : (
              <>
                Tiempo para {task}: <b className='tabular-nums'>{time}</b>
              </>
            )}
          </span>
        </div>
      )}
      {/* Sólo avisa al cambiar de etapa, no cada segundo. */}
      <span className='sr-only' aria-live='polite'>
        {ANNOUNCEMENTS[phase](task)}
      </span>
    </div>
  );
}
