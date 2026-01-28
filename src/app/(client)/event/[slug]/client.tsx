'use client';
import { isAfter } from 'date-fns';
import { useSearchParams } from 'next/navigation';

import ErrorCard from '@/components/common/ErrorCard';
import GoBack from '@/components/common/GoBack';
import HeaderTickets from '@/components/event/buyPage/HeaderTickets';
import InformationEvent from '@/components/event/buyPage/InformationEvent';
import TicketPurchase from '@/components/event/buyPage/TicketPurchase';
import { type RouterOutputs } from '@/server/routers/app';
import { ORGANIZER_CODE_QUERY_PARAM } from '@/server/utils/constants';

export default function Client({
  event,
}: {
  event: NonNullable<RouterOutputs['events']['getBySlug']>;
}) {
  const searchParams = useSearchParams();

  const organizerCode = searchParams.get(ORGANIZER_CODE_QUERY_PARAM);

  if (!isAfter(new Date(event.endingDate), new Date())) {
    return (
      <ErrorCard
        title='Evento finalizado'
        description='El evento que buscas ya finalizó. Podés ver todos nuestros eventos en la página principal.'
        route='/'
      />
    );
  }

  return (
    <div>
      <div className='flex my-4 mx-4'>
        <GoBack route='/' />
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
                ticketTypes={event.ticketTypes}
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
