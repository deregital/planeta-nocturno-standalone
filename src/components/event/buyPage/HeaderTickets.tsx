import { MapPin } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';

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
    <div className='grid grid-cols-1 md:grid-cols-12 w-full h-full overflow-hidden'>
      {/* Lado izquierdo - Nombre del evento y fecha */}
      <div className='col-span-1 md:col-span-5 px-4 py-2 md:px-4 md:py-3 lg:px-6 lg:py-4 flex flex-col justify-center overflow-hidden relative'>
        {/* Fondo solo visible en móvil (menos que md) */}
        <div
          className='absolute inset-0 bg-cover bg-center md:hidden'
          style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        ></div>

        {/* Overlay para mejorar legibilidad del texto en mobile */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/40 to-black/20 md:hidden'></div>

        <div className='relative z-10'>
          <h1 className='text-xl md:text-2xl lg:text-3xl font-bold text-white md:text-black line-clamp-2 md:line-clamp-1'>
            {event.name}
          </h1>
          <p className='text-sm lg:text-base whitespace-nowrap text-white/80 md:text-black/75 capitalize mt-2 overflow-hidden text-ellipsis'>
            {formattedDate}
          </p>
        </div>
      </div>

      {/* Medio - Banner del evento (solo visible en desktop) */}
      <div className='hidden md:block md:col-span-5 h-full'>
        <div
          className='w-full h-full bg-cover bg-center'
          style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        ></div>
      </div>

      {/* Lado derecho - Ubicación */}
      <div className='col-span-1 md:col-span-2 px-4 py-2 md:px-4 md:py-3 lg:px-6 lg:py-4 flex items-center justify-start md:border-l border-[#A3A3A3] overflow-hidden'>
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
    </div>
  );
}

export default HeaderTickets;
