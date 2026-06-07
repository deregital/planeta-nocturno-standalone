'use client';

import { X } from 'lucide-react';
import { useState } from 'react';

import InputWithLabel from '@/components/common/InputWithLabel';
import EventVideoEmbed from '@/components/event/buyPage/EventVideoEmbed';
import { EventVideoSlot } from '@/components/event/EventVideoSlot';
import { parseVideoEmbedUrl } from '@/lib/event-video-url';
import { cn } from '@/lib/utils';

interface EventVideoFieldProps {
  videoUrl: string | null;
  error?: string;
  readOnly?: boolean;
  onChange: (value: string | null) => void;
  className?: string;
  slotClassName?: string;
}

export default function EventVideoField({
  videoUrl,
  error,
  readOnly = false,
  onChange,
  className,
  slotClassName,
}: EventVideoFieldProps) {
  const [open, setOpen] = useState(false);
  const hasValidVideo = Boolean(videoUrl && parseVideoEmbedUrl(videoUrl));

  if (readOnly && !hasValidVideo) {
    return null;
  }

  if (!open) {
    return (
      <div
        className={cn(
          'flex shrink-0 justify-center md:justify-start',
          className,
        )}
      >
        <EventVideoSlot
          open={false}
          onToggle={() => setOpen(true)}
          label='YouTube'
          hasVideo={hasValidVideo}
          slotClassName={slotClassName}
        />
      </div>
    );
  }

  return (
    <div className={cn('min-w-0 w-full max-w-md flex-1', className)}>
      <div className='flex w-full flex-col gap-3 rounded-md border-2 border-stroke/70 bg-accent-ultra-light p-3'>
        <div className='flex items-center justify-between gap-2'>
          <p className='text-sm font-semibold text-accent-dark'>
            {readOnly ? 'Video del evento' : 'Enlace de YouTube'}
          </p>
          <button
            type='button'
            onClick={() => setOpen(false)}
            className='inline-flex size-6 shrink-0 items-center justify-center rounded-full text-accent/60 transition-colors hover:bg-muted hover:text-accent'
            aria-label='Cerrar'
          >
            <X className='size-3.5' />
          </button>
        </div>

        {!readOnly ? (
          <>
            <InputWithLabel
              label=''
              id='videoUrl'
              type='url'
              placeholder='https://www.youtube.com/watch?v=...'
              name='videoUrl'
              value={videoUrl ?? ''}
              onChange={(e) => onChange(e.target.value.trim() || null)}
              error={error}
              className='w-full [&_input]:h-9 [&_input]:text-sm'
            />
            {hasValidVideo && (
              <EventVideoEmbed videoUrl={videoUrl} className='w-full' />
            )}
          </>
        ) : (
          hasValidVideo && (
            <EventVideoEmbed videoUrl={videoUrl} className='w-full' />
          )
        )}
      </div>
    </div>
  );
}
