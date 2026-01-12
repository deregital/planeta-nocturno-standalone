'use client';
import { type Route } from 'next';
import { useSearchParams } from 'next/navigation';
import { isAfter } from 'date-fns';

import ErrorCard from '@/components/common/ErrorCard';
import GoBack from '@/components/common/GoBack';
import HeaderTickets from '@/components/event/buyPage/HeaderTickets';
import InformationEvent from '@/components/event/buyPage/InformationEvent';
import TicketPurchase from '@/components/event/buyPage/TicketPurchase';
import { type RouterOutputs } from '@/server/routers/app';
import {
  ORGANIZER_CODE_QUERY_PARAM,
  ORGANIZER_TICKET_TYPE_NAME,
  TICKET_TYPE_SLUG_QUERY_PARAM,
} from '@/server/utils/constants';

export default function Client({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const searchParams = useSearchParams();

  const organizerCode = searchParams.get(ORGANIZER_CODE_QUERY_PARAM);
  const ticketTypeSlug = searchParams.get(TICKET_TYPE_SLUG_QUERY_PARAM);

  if (!isAfter(new Date(event.endingDate), new Date())) {
    return (
      <ErrorCard
        title='Evento finalizado'
        description='El evento que buscas ya finalizó. Podés ver todos nuestros eventos en la página principal.'
        route='/'
      />
    );
  }

  // Filtrar ticketTypes según el parámetro de query
  let filteredTicketTypes = event.ticketTypes;
  if (ticketTypeSlug) {
    // Si hay un slug de ticketType, mostrar SOLO ese tipo (ignorando visibleInWeb)
    const matchedTicketType = event.ticketTypes.find(
      (ticketType) => ticketType.slug === ticketTypeSlug,
    );

    // Si el ticketType es de organizador, mostrar error
    if (
      matchedTicketType &&
      matchedTicketType.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim()
    ) {
      return (
        <ErrorCard
          title='Tipo de ticket no disponible'
          description='El tipo de ticket que intentas acceder no está disponible para compra pública.'
          route={`/event/${event.slug}` as Route}
        />
      );
    }

    filteredTicketTypes = matchedTicketType ? [matchedTicketType] : [];
  } else {
    // Si no hay slug, mantener el filtro normal
    filteredTicketTypes = event.ticketTypes.filter(
      (ticketType) =>
        ticketType.visibleInWeb &&
        ticketType.maxSellDate &&
        isAfter(new Date(ticketType.maxSellDate), new Date()),
    );
  }

  return (
    <div>
      <div className='flex my-4 mx-4'>
        <GoBack />
      </div>
      <div className='flex justify-center px-1 sm:px-4 my-6'>
        <main className='w-full max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-5rem)] lg:max-w-6xl rounded-3xl border-2 border-stroke overflow-hidden h-fit'>
          {/* Header - Usado tanto en móvil como en escritorio */}
          <div className='border-b border-stroke overflow-hidden'>
            <HeaderTickets event={event} />
          </div>

          <div className='mt-6 flex flex-col md:grid md:grid-cols-16 border-stroke overflow-hidden'>
            <div className='px-4 md:px-6 pb-4 md:col-span-12 overflow-hidden'>
              <TicketPurchase
                eventId={event.id}
                ticketTypes={filteredTicketTypes}
                invitedBy={organizerCode}
              />
            </div>
            <div className='px-4 md:col-span-4 flex flex-col justify-start items-center overflow-hidden'>
              <InformationEvent description={event.description} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
