import { formatInTimeZone } from 'date-fns-tz';

import { type ScanEntry } from '@/components/event/individual/scan/useScanSession';
import { Button } from '@/components/ui/button';

const WARNING_STATUSES = new Set(['too-early', 'expired']);

export function LastScanCard({
  lastScan,
  onForce,
  isForcing,
}: {
  lastScan: ScanEntry;
  /** 'Dejar pasar igual' para una entrada fuera de horario. */
  onForce?: (barcode: string) => void;
  isForcing?: boolean;
}) {
  const isWarning = WARNING_STATUSES.has(lastScan.status);

  return (
    <div className='relative w-full min-h-fit rounded-2xl border-2 border-stroke overflow-hidden'>
      {/* Hora del intento: en el historial no se sabía cuándo fue cada uno. */}
      <div className='absolute top-0 right-0 text-xs text-accent-dark/60 font-bold bg-background/80 p-2 rounded'>
        {formatInTimeZone(
          new Date(lastScan.at),
          'America/Argentina/Buenos_Aires',
          'HH:mm:ss',
        )}
      </div>
      {lastScan.status === 'success' ? (
        <>
          <div className='bg-green-500 border-b border-stroke'>
            <p className='text-on-accent text-lg font-bold p-2 truncate'>
              {lastScan.ticket?.fullName}
            </p>
          </div>
          <p className='text-accent-dark p-2 text-normal'>
            <span className='font-bold'>DNI:</span> {lastScan.ticket?.dni}
          </p>
          <p className='text-accent-dark p-2 text-sm'>
            <span className='font-bold'>Evento:</span>{' '}
            {lastScan.ticket?.ticketGroup?.event?.name}
          </p>
          <p className='text-accent-dark p-2 text-sm'>
            <span className='font-bold'>Invitado por:</span>{' '}
            {lastScan.ticket?.ticketGroup?.invitedBy || '-'}
          </p>
          <p className='text-accent-dark p-2 text-sm'>
            <span className='font-bold'>Tipo de ticket:</span>{' '}
            {lastScan.ticket?.ticketType.name || '-'}
          </p>
          {lastScan.extraInfo && (
            <p className='text-accent-dark p-2 text-sm bg-amber-300'>
              <span className='font-bold'>Extra:</span> {lastScan.extraInfo}
            </p>
          )}
        </>
      ) : (
        <>
          <div
            className={`${isWarning ? 'bg-amber-400 text-accent-dark' : 'bg-red-500'} p-2 font-bold`}
          >
            {lastScan.text}
          </div>
          <div className='text-accent-dark p-2 text-sm'>
            {lastScan.ticket && (
              <>
                <p className='text-accent-dark p-2 text-sm'>
                  <span className='font-bold'>Nombre:</span>{' '}
                  {lastScan.ticket.fullName}
                </p>
                <p className='text-accent-dark p-2 text-sm'>
                  <span className='font-bold'>DNI:</span> {lastScan.ticket.dni}
                </p>
                {isWarning && (
                  <p className='text-accent-dark p-2 text-sm'>
                    <span className='font-bold'>Tipo de ticket:</span>{' '}
                    {lastScan.ticket.ticketType.name}
                  </p>
                )}
              </>
            )}
            <p className='p-2'>{lastScan.extraInfo}</p>
            {isWarning && onForce && (
              <Button
                variant='accent'
                className='m-2 w-[calc(100%-1rem)]'
                loading={isForcing}
                onClick={() => onForce(lastScan.barcode)}
              >
                Dejar pasar igual
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
