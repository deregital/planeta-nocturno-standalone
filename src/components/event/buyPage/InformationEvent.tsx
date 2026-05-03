'use client';

import { ChevronDown } from 'lucide-react';

import { type RouterOutputs } from '@/server/routers/app';

interface InformationEventProps {
  description: RouterOutputs['events']['getById']['description'];
}
function InformationEvent({ description }: InformationEventProps) {
  return (
    <div className='mb-2 w-full bg-white md:mb-0 md:h-[calc(100%-16px)]'>
      <div className='flex flex-col p-2 md:items-center md:px-4 md:py-6'>
        <h2 className='mb-2 text-sm font-bold text-black md:mb-3 md:text-base md:text-center'>
          Descripción del evento
        </h2>
        <div className='md:hidden'>
          {description.length > 100 ? (
            <details className='group'>
              <summary className='list-none [&::-webkit-details-marker]:hidden'>
                <div className='min-w-0'>
                  <p className='line-clamp-2 text-sm leading-relaxed text-black/90 group-open:line-clamp-none'>
                    {description}
                  </p>
                  <div className='mt-2 flex items-center gap-2 text-xs font-semibold text-accent'>
                    <span className='group-open:hidden'>Ver más</span>
                    <span className='hidden group-open:inline'>Ver menos</span>
                    <ChevronDown className='size-4 shrink-0 transition-transform duration-200 group-open:rotate-180' />
                  </div>
                </div>
              </summary>
            </details>
          ) : (
            <p className='text-sm leading-relaxed text-black/90'>
              {description}
            </p>
          )}
        </div>

        <p className='hidden text-center text-base font-light leading-relaxed text-black md:block'>
          {description}
        </p>
      </div>
    </div>
  );
}

export default InformationEvent;
