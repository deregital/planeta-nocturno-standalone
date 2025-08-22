import { trpc } from '@/server/trpc/server';
import HeaderTickets from '@/components/event/buyPage/HeaderTickets';
import InformationEvent from '@/components/event/buyPage/InformationEvent';
import TicketPurchase from '@/components/event/buyPage/TicketPurchase';

interface EventPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await trpc.events.getBySlug(slug);

  if (!event) {
    return (
      <div className='max-w-7xl mx-5 md:mx-[3rem] py-8 px-4'>
        <h1 className='text-2xl font-bold text-center'>Evento no encontrado</h1>
      </div>
    );
  }

  return (
    <div className='flex justify-center px-1 sm:px-4 my-14'>
      <main className='w-full max-w-[calc(100%-2rem)] sm:max-w-[calc(100%-5rem)] lg:max-w-6xl rounded-3xl border-2 border-pn-gray overflow-hidden'>
        {/* Header - Usado tanto en móvil como en escritorio */}
        <div className='border-b border-pn-gray overflow-hidden'>
          <HeaderTickets event={event} />
        </div>

        <div className='mt-6 flex flex-col md:grid md:grid-cols-16 border-pn-gray overflow-hidden'>
          <div className='px-4 md:px-6 pb-4 md:col-span-12 overflow-hidden'>
            <TicketPurchase
              eventId={event.id}
              ticketTypes={event.ticketTypes}
            />
          </div>
          <div className='px-4 md:col-span-4 flex flex-col justify-start items-center overflow-hidden'>
            <InformationEvent description={event.description} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default EventPage;
