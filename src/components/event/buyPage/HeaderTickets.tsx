import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import Image from 'next/image';

import { type RouterOutputs } from '@/server/routers/app';

function HeaderTickets({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  // Formatear la fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatInTimeZone(
      date,
      'America/Argentina/Buenos_Aires',
      "EEEE d 'de' MMMM yyyy - 'inicio' HH:mm 'hs'",
      {
        locale: es,
      },
    );
  };

  const formattedDate = formatDate(event.startingDate);

  // URL de la imagen de fondo para móviles
  const backgroundImageUrl = event.coverImageUrl
    ? event.coverImageUrl
    : '/Foto.png';

  return (
    <div className='relative w-full md:pr-36 lg:pr-44'>
      {/* Lado izquierdo - Nombre del evento y fecha */}
      <div className='grid min-w-0 w-full grid-cols-1 md:grid-cols-[7fr_2fr] md:items-stretch'>
        <div className='col-span-1 border-b border-stroke px-4 py-2 md:border-b-0 md:px-4 md:py-3 lg:px-6 lg:py-4'>
          <div className='flex flex-row items-start gap-3 sm:gap-4'>
            <div className='min-w-0 flex-1'>
              <h1 className='text-balance text-xl font-normal text-black md:text-2xl lg:text-2xl'>
                <span className='line-clamp-2 md:line-clamp-1'>
                  {event.name}
                </span>
              </h1>
              <p className='mt-2 max-w-full text-pretty text-sm capitalize text-black md:text-accent lg:text-base'>
                {formattedDate}
              </p>
            </div>
            <div className='relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg sm:w-24 md:hidden'>
              <Image
                alt={`Portada de ${event.name}`}
                src={backgroundImageUrl}
                fill
                className='object-cover'
              />
            </div>
          </div>
        </div>
        <div className='col-span-1 flex items-center justify-start overflow-hidden border-stroke px-4 py-2 md:border-l md:px-3 md:py-3 lg:px-4 lg:py-4 md:min-w-0'>
          <div className='flex min-w-0 items-start gap-1.5 md:gap-1.5'>
            <div className='flex shrink-0 items-center justify-center'>
              <MapPin
                className='h-5 w-5 shrink-0 text-black sm:h-6 sm:w-6 md:h-4 md:w-4 lg:h-5 lg:w-5'
                strokeWidth={1.5}
              />
            </div>
            <div className='min-w-0 text-sm md:text-xs lg:text-sm'>
              <p
                className='font-semibold text-black line-clamp-3 md:line-clamp-2'
                title={event.location.address}
              >
                {event.location.address}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Portada en desktop */}
      <div className='pointer-events-none absolute inset-y-0 right-0 z-1 hidden w-36 bg-white md:flex lg:w-44'>
        <div className='pointer-events-auto flex h-full w-full items-center justify-end pr-0 pl-2 py-3 lg:pl-3 lg:py-4'>
          <div className='relative aspect-square w-28 max-w-full overflow-hidden rounded-l-xl rounded-r-none border border-stroke/80 shadow-sm ring-1 ring-black/6 lg:w-32'>
            <Image
              alt={`Portada de ${event.name}`}
              src={backgroundImageUrl}
              fill
              className='object-cover'
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeaderTickets;
