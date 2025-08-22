'use client';

import { type RouterOutputs } from '@/server/routers/app';
import { Ticket } from 'lucide-react';
import { useMemo } from 'react';

export function QuantityTicketsEmitted({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const eventTickets = useMemo(
    () => event.ticketGroups.flatMap((tg) => tg.emittedTickets),
    [event],
  );
  const emittableTickets = useMemo(
    () =>
      event.ticketTypes.reduce((acc, curr) => {
        return acc + curr.maxAvailable;
      }, 0),
    [event],
  );

  return (
    <div className='flex flex-row gap-x-2 items-center'>
      <Ticket />
      <p className='flex items-center gap-x-0.5'>
        Tickets emitidos: {eventTickets.length} de {emittableTickets}
      </p>
    </div>
  );
}
