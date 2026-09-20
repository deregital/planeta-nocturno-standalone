'use client';

import { formatInTimeZone } from 'date-fns-tz';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { type RouterOutputs } from '@/server/routers/app';

type TicketRow = RouterOutputs['emittedTickets']['getByEventId'][number];

const SCAN_DATETIME_FORMAT = 'dd/MM/yyyy HH:mm:ss';

function formatScanDateTime(scannedAt: string) {
  return formatInTimeZone(
    new Date(scannedAt),
    'America/Argentina/Buenos_Aires',
    SCAN_DATETIME_FORMAT,
  );
}

export function TicketEntryTimeCell({ ticket }: { ticket: TicketRow }) {
  if (!ticket.scannedAt) {
    return <p className='w-full text-center'>-</p>;
  }

  const formattedTime = formatScanDateTime(ticket.scannedAt);
  const scanCount = ticket.emittedTicketScans.length;
  const showScanHistory = ticket.ticketType.allowMultipleScans && scanCount > 1;

  if (!showScanHistory) {
    return <p className='w-full text-center tabular-nums'>{formattedTime}</p>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='w-full text-center underline decoration-dotted underline-offset-2 cursor-pointer hover:text-accent tabular-nums'
        >
          {formattedTime} ({scanCount})
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-80 p-3' align='center'>
        <p className='mb-2 text-sm font-semibold'>Historial de escaneos</p>
        <ul className='max-h-48 space-y-2 overflow-y-auto'>
          {ticket.emittedTicketScans.map((scan) => (
            <li
              key={scan.id}
              className='flex items-start justify-between gap-3 text-sm'
            >
              <span className='shrink-0 tabular-nums'>
                {formatScanDateTime(scan.scannedAt)}
              </span>
              <span className='truncate text-right text-muted-foreground'>
                {`${scan.scannedByUserId ? 'por ' : '-'} ${scan.user?.fullName || '-'}`}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
