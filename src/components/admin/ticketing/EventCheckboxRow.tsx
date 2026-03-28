'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { type RouterOutputs } from '@/server/routers/app';

export default function EventCheckboxRow({
  event,
  onCheckedChange,
}: {
  event: RouterOutputs['events']['getAllForTicketing'][number];
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label className='flex items-center gap-4 p-4 rounded-xl border border-stroke bg-accent-ultra-light hover:bg-accent/5 cursor-pointer has-data-[state=checked]:border-accent has-data-[state=checked]:bg-accent/10 transition-colors'>
      <Checkbox
        name='ids'
        value={event.id}
        onCheckedChange={onCheckedChange}
        className='data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-white'
      />
      <div className='flex-1 min-w-0'>
        <p className='font-semibold text-accent'>{event.name}</p>
        <div className='flex items-center gap-1 text-xs text-accent-dark/60 mt-0.5'>
          <CalendarDays className='size-3' />
          <span>
            {format(new Date(event.startingDate), "d MMM yyyy · HH'h'", {
              locale: es,
            })}
          </span>
          {event.location && (
            <span className='truncate'>· {event.location.name}</span>
          )}
        </div>
      </div>
    </label>
  );
}
