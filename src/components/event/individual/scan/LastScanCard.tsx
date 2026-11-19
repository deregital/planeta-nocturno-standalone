import { formatInTimeZone } from 'date-fns-tz';

import { type ScanDisplayResult } from '@/components/event/individual/scan/scan-result';
import { Button } from '@/components/ui/button';
import { OUT_OF_WINDOW_STATUSES } from '@/lib/scan/decision';

/** Qué pasó con un escaneo que el celular dio por bueno (modo rápido). */
const LOCAL_SYNC_TEXT: Record<
  NonNullable<ScanDisplayResult['sync']>,
  string
> = {
  pending: 'Escaneado en este celular · pendiente de subir',
  confirmed: 'Escaneado en este celular · registrado',
  duplicate: 'Escaneado en este celular · ticket escaneado dos veces',
  'not-found': 'Escaneado en este celular · ticket eliminado',
};

export function LastScanCard({
  lastScan,
  onForce,
  isForcing,
}: {
  lastScan: ScanDisplayResult;
  /** "Dejar pasar igual" una entrada fuera de horario. */
  onForce?: (barcode: string) => void;
  isForcing?: boolean;
}) {
  const isOutOfWindow = OUT_OF_WINDOW_STATUSES.has(lastScan.status);
  return (
    <div className='relative w-full min-h-fit rounded-2xl border-2 border-stroke overflow-hidden'>
      {lastScan.ticket?.scannedAt && (
        <div className='absolute top-0 right-0 text-xs text-accent-dark/60 font-bold bg-background/80 p-2 rounded'>
          {formatInTimeZone(
            new Date(lastScan.ticket.scannedAt),
            'America/Argentina/Buenos_Aires',
            'dd/MM HH:mm:ss',
          )}
        </div>
      )}
      {lastScan.status === 'self-repeat' ? (
        <>
          <div className='bg-sky-500 border-b border-stroke'>
            {/* pr-28: lugar para la hora de arriba a la derecha. */}
            <p className='text-on-accent text-lg font-bold p-2 pr-28 break-words'>
              {lastScan.text}: {lastScan.ticket?.fullName}
            </p>
          </div>
          <p className='text-accent-dark p-2 text-normal'>
            <span className='font-bold'>DNI:</span> {lastScan.ticket?.dni}
          </p>
          <p className='text-accent-dark p-2 text-sm'>{lastScan.extraInfo}</p>
        </>
      ) : lastScan.status === 'success' ? (
        <>
          <div className='bg-green-500 border-b border-stroke'>
            <p className='text-on-accent text-lg font-bold p-2 pr-28 break-words'>
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
          {lastScan.decidedBy === 'local' && (
            <p className='text-accent-dark/60 px-2 pb-2 text-xs'>
              {LOCAL_SYNC_TEXT[lastScan.sync ?? 'pending']}
            </p>
          )}
        </>
      ) : (
        <>
          <div
            className={
              // Ámbar: no hubo decisión (sin red, servidor) o está fuera de
              // horario. Naranja: aviso de un ingreso que ya pasó (doble
              // ingreso). Rojo: rechazada.
              lastScan.status === 'error' || isOutOfWindow
                ? 'bg-amber-400 p-2 font-bold text-amber-950'
                : lastScan.status === 'conflict'
                  ? 'bg-orange-500 p-2 font-bold text-white'
                  : 'bg-red-500 p-2 font-bold'
            }
          >
            {lastScan.text}
          </div>
          <div className='text-accent-dark p-2 text-sm'>
            {lastScan.ticket && (
              <>
                <p className='text-accent-dark p-2 text-sm'>
                  <span className='font-bold'>Nombre:</span>{' '}
                  {lastScan.ticket?.fullName}
                </p>
                <p className='text-accent-dark p-2 text-sm'>
                  <span className='font-bold'>DNI:</span> {lastScan.ticket?.dni}
                </p>
                {isOutOfWindow && (
                  <p className='text-accent-dark p-2 text-sm'>
                    <span className='font-bold'>Tipo de ticket:</span>{' '}
                    {lastScan.ticket.ticketType.name}
                  </p>
                )}
              </>
            )}
            {lastScan.extraInfo}
          </div>
          {isOutOfWindow && onForce && lastScan.barcode && (
            <div className='p-2'>
              <Button
                variant='accent'
                className='w-full'
                loading={isForcing}
                onClick={() => onForce(lastScan.barcode!)}
              >
                Dejar pasar igual
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
