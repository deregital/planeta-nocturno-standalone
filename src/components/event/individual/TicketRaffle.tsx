'use client';

import { Dices } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type RaffleTicket = {
  shortId: number;
  fullName: string;
  dni: string;
};

type SpinPhase = 'idle' | 'spinning' | 'revealed';

const DIGIT_HEIGHT = 80;
const REEL_LOOPS = 8;

function pickRandomTicket(tickets: RaffleTicket[]): RaffleTicket {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return tickets[buffer[0]! % tickets.length]!;
}

function DigitReel({
  digit,
  spinning,
  stopDelayMs,
  onStopped,
}: {
  digit: number;
  spinning: boolean;
  stopDelayMs: number;
  onStopped?: () => void;
}) {
  const [offset, setOffset] = useState(digit * DIGIT_HEIGHT);
  const [transition, setTransition] = useState('none');
  const stoppedRef = useRef(false);
  const onStoppedRef = useRef(onStopped);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onStoppedRef.current = onStopped;
  }, [onStopped]);

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!spinning) return;

    stoppedRef.current = false;
    setTransition('none');
    let frame = 0;

    spinIntervalRef.current = setInterval(() => {
      frame += 1;
      setOffset(((frame % 10) + REEL_LOOPS * 10) * DIGIT_HEIGHT);
    }, 45);

    stopTimeoutRef.current = setTimeout(() => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }

      const finalOffset = (REEL_LOOPS * 10 + digit) * DIGIT_HEIGHT;
      setTransition('transform 900ms cubic-bezier(0.15, 0.85, 0.25, 1)');
      setOffset(finalOffset);

      settleTimeoutRef.current = setTimeout(() => {
        if (!stoppedRef.current) {
          stoppedRef.current = true;
          onStoppedRef.current?.();
        }
      }, 920);
    }, stopDelayMs);

    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, [spinning, digit, stopDelayMs]);

  const strip = useMemo(
    () => Array.from({ length: REEL_LOOPS * 10 + 10 }, (_, i) => i % 10),
    [],
  );

  return (
    <div
      className='relative w-[56px] overflow-hidden rounded-[10px] border-2 border-accent/30 bg-accent-ultra-light shadow-inner sm:w-[68px]'
      style={{ height: DIGIT_HEIGHT }}
    >
      <div
        className='pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-white/80 to-transparent'
        aria-hidden
      />
      <div
        className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-white/80 to-transparent'
        aria-hidden
      />
      <div
        className='pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2 bg-accent/25'
        aria-hidden
      />
      <div
        className='flex flex-col will-change-transform'
        style={{
          transform: `translateY(-${offset}px)`,
          transition,
        }}
      >
        {strip.map((n, i) => (
          <div
            key={i}
            className='flex shrink-0 items-center justify-center font-mono text-4xl font-black tracking-tight text-accent-dark sm:text-5xl'
            style={{ height: DIGIT_HEIGHT }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotMachine({
  targetNumber,
  digitCount,
  spinning,
  spinKey,
  onSpinComplete,
}: {
  targetNumber: number | null;
  digitCount: number;
  spinning: boolean;
  spinKey: number;
  onSpinComplete: () => void;
}) {
  const [stoppedCount, setStoppedCount] = useState(0);
  const completedForKey = useRef<number | null>(null);

  const digits = useMemo(() => {
    const padded = String(targetNumber ?? 0).padStart(digitCount, '0');
    return padded.split('').map((d) => Number(d));
  }, [targetNumber, digitCount]);

  useEffect(() => {
    setStoppedCount(0);
  }, [spinKey]);

  useEffect(() => {
    if (
      spinning &&
      stoppedCount >= digitCount &&
      completedForKey.current !== spinKey
    ) {
      completedForKey.current = spinKey;
      onSpinComplete();
    }
  }, [stoppedCount, digitCount, spinning, spinKey, onSpinComplete]);

  return (
    <div className='relative mx-auto w-full max-w-md'>
      <div className='rounded-[10px] border-2 border-accent/20 bg-accent-ultra-light/60 p-4 sm:p-5'>
        <div className='rounded-[10px] border border-stroke bg-white p-3 sm:p-4'>
          <div className='flex items-center justify-center gap-1.5 sm:gap-2'>
            {digits.map((digit, index) => (
              <DigitReel
                key={`${spinKey}-${index}`}
                digit={digit}
                spinning={spinning}
                stopDelayMs={1100 + index * 420}
                onStopped={() => setStoppedCount((c) => c + 1)}
              />
            ))}
          </div>
        </div>
        <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-accent/15'>
          <div
            className={cn(
              'h-full rounded-full bg-accent transition-all duration-500',
              spinning ? 'w-full animate-pulse' : 'w-0',
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function TicketRaffle({ tickets }: { tickets: RaffleTicket[] }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<SpinPhase>('idle');
  const [winner, setWinner] = useState<RaffleTicket | null>(null);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState(0);

  const digitCount = useMemo(() => {
    if (tickets.length === 0) return 2;
    const maxId = Math.max(...tickets.map((t) => t.shortId));
    return Math.max(String(maxId).length, 2);
  }, [tickets]);

  const reset = () => {
    setPhase('idle');
    setWinner(null);
    setDisplayNumber(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const spin = () => {
    if (tickets.length === 0 || phase === 'spinning') return;
    const picked = pickRandomTicket(tickets);
    setWinner(picked);
    setDisplayNumber(picked.shortId);
    setSpinKey((k) => k + 1);
    setPhase('spinning');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='outline' className='flex gap-x-2'>
          Sorteo
          <Dices className='size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle className='text-2xl font-bold text-accent'>
            Sorteo de tickets
          </DialogTitle>
          <DialogDescription>
            {tickets.length === 0
              ? 'Todavía no hay tickets emitidos para sortear.'
              : `Se elige al azar entre los tickets del evento.`}
          </DialogDescription>
        </DialogHeader>

        <div className='mt-2 space-y-6'>
          <SlotMachine
            targetNumber={displayNumber}
            digitCount={digitCount}
            spinning={phase === 'spinning'}
            spinKey={spinKey}
            onSpinComplete={() => setPhase('revealed')}
          />

          <div
            className={cn(
              'min-h-[88px] rounded-[10px] border px-4 py-3 text-center transition-all duration-500',
              phase === 'revealed'
                ? 'border-accent/40 bg-accent-ultra-light'
                : 'border-stroke bg-accent-ultra-light/40',
            )}
          >
            {phase === 'revealed' && winner ? (
              <div className='animate-in fade-in zoom-in-95 duration-500'>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-accent'>
                  Ganador
                </p>
                <p className='mt-1 text-2xl font-bold text-accent-dark'>
                  #{winner.shortId}
                </p>
                <p className='mt-1 text-base font-medium text-accent-dark'>
                  {winner.fullName}
                </p>
                <p className='text-sm text-gray-500'>DNI {winner.dni}</p>
              </div>
            ) : (
              <div className='flex h-full min-h-[64px] items-center justify-center'>
                <p className='text-sm text-gray-500'>
                  {phase === 'spinning'
                    ? 'Girando los rodillos...'
                    : 'Presioná el botón para sortear'}
                </p>
              </div>
            )}
          </div>

          <div className='flex justify-center gap-3'>
            {phase === 'revealed' ? (
              <Button
                type='button'
                variant='accent'
                className='min-w-[160px]'
                onClick={() => handleOpenChange(false)}
              >
                Aceptar
              </Button>
            ) : (
              <Button
                type='button'
                variant='accent'
                className={cn(
                  'min-w-[160px]',
                  phase === 'spinning' && 'animate-pulse',
                )}
                onClick={spin}
                disabled={tickets.length === 0 || phase === 'spinning'}
              >
                {phase === 'spinning' ? 'Sorteando...' : '¡Sortear!'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
