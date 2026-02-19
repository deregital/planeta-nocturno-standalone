import { ScanQrCode, Ticket } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import { type RouterOutputs } from '@/server/routers/app';

export function QuantityTicketsEmitted({
  tickets,
  maxAvailable,
}: {
  tickets: NonNullable<
    RouterOutputs['events']['getBySlug']
  >['ticketGroups'][number]['emittedTickets'];
  maxAvailable?: number;
}) {
  const scannedTickets = tickets.filter((ticket) => ticket.scannedAt !== null);

  const emittedPercentage =
    maxAvailable && maxAvailable > 0
      ? (tickets.length / maxAvailable) * 100
      : 0;

  const scannedPercentage =
    tickets.length > 0 ? (scannedTickets.length / tickets.length) * 100 : 0;

  return (
    <div className='flex gap-4 mx-4'>
      <div className='flex flex-row gap-x-2 items-center'>
        <Ticket />
        <p className='flex items-center gap-x-0.5'>
          Tickets emitidos: {tickets.length}
          {maxAvailable &&
            ` de ${maxAvailable} (${emittedPercentage.toFixed(2)}%)`}
        </p>
      </div>
      <div className='flex items-center justify-center'>
        <Separator
          orientation='vertical'
          className='border-accent-ultra-light border'
        />
      </div>
      <div className='flex flex-row gap-x-2 items-center'>
        <ScanQrCode />
        <p className='flex items-center gap-x-0.5'>
          Tickets escaneados: {scannedTickets.length} de {tickets.length} (
          {scannedPercentage.toFixed(2)}%)
        </p>
      </div>
    </div>
  );
}
