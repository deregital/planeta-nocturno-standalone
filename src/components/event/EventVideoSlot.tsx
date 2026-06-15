'use client';

import { Play, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EventVideoSlotProps {
  open: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
  slotClassName?: string;
  hasVideo?: boolean;
}

export function EventVideoSlot({
  open,
  onToggle,
  label = 'Agregar video',
  className,
  slotClassName,
  hasVideo = false,
}: EventVideoSlotProps) {
  return (
    <button
      type='button'
      onClick={onToggle}
      className={cn(
        'bg-accent-ultra-light group relative aspect-video shrink-0 overflow-hidden rounded-md border border-dashed border-stroke/90 bg-linear-to-br from-muted/30 to-muted/10 text-accent transition-all hover:border-accent/35 hover:from-muted/45 hover:to-muted/20',
        'w-44 sm:w-56 sm:h-36',
        open &&
          'border-solid border-accent/40 bg-accent-ultra-light ring-1 ring-accent/15',
        hasVideo &&
          !open &&
          'border-solid border-stroke/70 from-accent-ultra-light/80 to-muted/20',
        slotClassName,
        className,
      )}
      aria-expanded={open}
      aria-label={open ? 'Cerrar video' : hasVideo ? 'Ver video' : label}
    >
      <div className='flex h-full flex-col items-center justify-center gap-1.5 px-2 cursor-pointer'>
        {open ? (
          <>
            <X className='size-5 text-accent/70' />
            <span className='text-xs font-medium text-accent/70'>Cerrar</span>
          </>
        ) : (
          <>
            <div className='flex size-11 items-center justify-center rounded-full ring-1 bg-white/90 ring-black/5 transition-transform'>
              <Play className='ml-0.5 size-5 fill-accent text-accent' />
            </div>
            <span className='text-center text-xs font-semibold tracking-wide text-accent/75'>
              {hasVideo ? 'Ver video' : label}
            </span>
          </>
        )}
      </div>
    </button>
  );
}
