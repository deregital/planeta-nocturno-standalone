import { isAfter } from 'date-fns';

import GoBack from '@/components/common/GoBack';
import HeaderTickets from '@/components/event/buyPage/HeaderTickets';
import InformationEvent from '@/components/event/buyPage/InformationEvent';
import TicketPurchase from '@/components/event/buyPage/TicketPurchase';
import Client from '@/app/(client)/event/[slug]/client';
import { trpc } from '@/server/trpc/server';

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
        <h1 className='text-2xl font-bold text-center text-accent-dark'>
          Evento no encontrado
        </h1>
      </div>
    );
  }

  return <Client event={event} />;
}

export default EventPage;
