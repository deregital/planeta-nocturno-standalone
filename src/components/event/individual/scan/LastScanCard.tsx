import { type RouterOutputs } from '@/server/routers/app';

export function LastScanCard({
  lastScan,
}: {
  lastScan: RouterOutputs['emittedTickets']['scan'];
}) {
  return (
    <div className='w-full min-h-fit rounded-2xl border-2 border-stroke overflow-hidden'>
      {lastScan.success ? (
        <>
          <div className='bg-green-500 border-b border-stroke'>
            <p className='text-on-accent text-lg font-bold p-2 truncate'>
              {lastScan.ticket?.fullName}
            </p>
          </div>
          <p className='text-accent-dark p-2 text-sm'>
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
        </>
      ) : (
        <>
          <div className='bg-red-500 p-2 font-bold'>{lastScan.text}</div>
          <div className='text-accent-dark p-2 text-sm'>
            {lastScan.extraInfo}
          </div>
        </>
      )}
    </div>
  );
}
