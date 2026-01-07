import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import { MapPin } from 'lucide-react';
import Image from 'next/image';

import { type RouterOutputs } from '@/server/routers/app';

function HeaderTickets({
  event,
}: {
  event: RouterOutputs['events']['getById'];
}) {
  // Formatear la fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatInTimeZone(
      date,
      'America/Argentina/Buenos_Aires',
      "EEEE d 'de' MMMM yyyy - HH:mm 'hrs.'",
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
    <div className='grid relative grid-cols-1 md:grid-cols-12 w-full h-full overflow-hidden'>
      {/* Lado izquierdo - Nombre del evento y fecha */}
      <div className='col-span-1 md:col-span-5 px-4 py-2 md:px-4 md:py-3 lg:px-6 lg:py-4 flex flex-col justify-center overflow-hidden relative border-b border-stroke md:border-b-0'>
        {/* Fondo solo visible en móvil (menos que md) */}
        <div className='absolute right-0 bg-cover aspect-square bg-center h-full hidden min-[400px]:block md:hidden'>
          <Image
            alt='Imagen del evento'
            src={backgroundImageUrl}
            width={100}
            height={100}
          />
        </div>

        <div className='relative z-10'>
          <h1 className='text-xl md:text-2xl lg:text-3xl font-base text-black line-clamp-2 md:line-clamp-1'>
            {event.name}
          </h1>
          <p className='text-sm lg:text-base whitespace-nowrap text-black md:text-accent capitalize mt-2 overflow-hidden text-ellipsis'>
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Lado derecho - Ubicación */}
      <div className='col-span-1 flex-1 md:col-span-6 px-4 py-2 md:px-4 md:py-3 lg:px-6 lg:py-4 flex items-center justify-start md:border-l border-stroke overflow-hidden'>
        <div className='flex items-start min-w-0'>
          <div className='flex items-center justify-center mr-2'>
            <MapPin
              className='text-black flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 md:h-5 md:w-5 lg:h-6 lg:w-6'
              strokeWidth={1.5}
            />
          </div>
          <div className='text-sm lg:text-base h-full min-w-0'>
            <p
              className='font-semibold text-black line-clamp-3'
              title={event.location.address}
            >
              {event.location.address}
            </p>
          </div>
        </div>
      </div>

      {/* Medio - Banner del evento (solo visible en desktop) */}
      <div className='hidden absolute right-0 md:block md:col-span-1 h-full w-fit'>
        <div className='aspect-square h-full max-h-25 bg-cover bg-center'>
          <Image
            alt='Imagen del evento'
            src={backgroundImageUrl}
            width={100}
            height={100}
          />
        </div>
      </div>
    </div>
  );
}

export default HeaderTickets;
