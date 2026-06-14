'use client';

import { ChevronDown } from 'lucide-react';

import EventDescriptionContent from '@/components/event/buyPage/EventDescriptionContent';
import EventVideoEmbed from '@/components/event/buyPage/EventVideoEmbed';
import { parseVideoEmbedUrl } from '@/lib/event-video-url';
import { type RouterOutputs } from '@/server/routers/app';

interface InformationEventProps {
  description: RouterOutputs['events']['getById']['description'];
  videoUrl?: RouterOutputs['events']['getById']['videoUrl'];
}

function InformationEvent({ description, videoUrl }: InformationEventProps) {
  const hasVideo = Boolean(videoUrl && parseVideoEmbedUrl(videoUrl));

  return (
    <div className='mb-2 w-full bg-white md:mb-0 md:h-[calc(100%-16px)]'>
      <div className='flex flex-col p-2 md:items-center md:px-4 md:py-6'>
        <h2 className='mb-2 text-sm font-bold text-black md:mb-3 md:text-base md:text-center'>
          Descripción del evento
        </h2>
        <div className='w-full md:hidden'>
          {description.length > 100 ? (
            <details className='group'>
              <summary className='list-none [&::-webkit-details-marker]:hidden'>
                <div className='min-w-0'>
                  <div className='line-clamp-2 group-open:line-clamp-none'>
                    <EventDescriptionContent description={description} />
                  </div>
                  <div className='mt-2 flex items-center gap-2 text-xs font-semibold text-accent'>
                    <span className='group-open:hidden'>Ver más</span>
                    <span className='hidden group-open:inline'>Ver menos</span>
                    <ChevronDown className='size-4 shrink-0 transition-transform duration-200 group-open:rotate-180' />
                  </div>
                </div>
              </summary>
            </details>
          ) : (
            <EventDescriptionContent description={description} />
          )}
        </div>

        <div className='hidden w-full text-center md:block'>
          <EventDescriptionContent description={description} />
        </div>

        {hasVideo && (
          <EventVideoEmbed
            videoUrl={videoUrl}
            className='mt-4 w-full md:mt-5'
          />
        )}
      </div>
    </div>
  );
}

export default InformationEvent;
