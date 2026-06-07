'use client';

import { parseVideoEmbedUrl } from '@/lib/event-video-url';
import { cn } from '@/lib/utils';

interface EventVideoEmbedProps {
  videoUrl: string | null | undefined;
  className?: string;
}

export default function EventVideoEmbed({
  videoUrl,
  className,
}: EventVideoEmbedProps) {
  const embedUrl = videoUrl ? parseVideoEmbedUrl(videoUrl) : null;

  if (!embedUrl) {
    return null;
  }

  return (
    <div
      className={cn(
        'aspect-video w-full overflow-hidden rounded-md bg-black/5',
        className,
      )}
    >
      <iframe
        src={embedUrl}
        title='Video del evento'
        className='h-full w-full border-0'
        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        allowFullScreen
      />
    </div>
  );
}
