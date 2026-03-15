import { QrCode } from 'lucide-react';

import EventCheckboxRow from '@/components/admin/ticketing/EventCheckboxRow';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/server';

export default async function TicketingPage() {
  const events = await trpc.events.getAllSoon();

  return (
    <form
      action='/admin/ticketing/scan'
      method='get'
      className='flex flex-col gap-6 p-4 max-w-lg mx-auto w-full'
    >
      <h1 className='text-2xl font-bold text-accent'>Escanear Tickets</h1>

      <div className='flex flex-col gap-2'>
        {events.length === 0 ? (
          <p className='text-accent-dark/50 text-sm'>
            No hay eventos para hoy ni mañana.
          </p>
        ) : (
          events.map((event) => (
            <EventCheckboxRow key={event.id} event={event} />
          ))
        )}
      </div>

      <div className='sticky bottom-4'>
        <Button
          type='submit'
          variant='accent'
          className='w-full py-6 text-base gap-2'
          disabled={events.length === 0}
        >
          <QrCode className='size-5' />
          Iniciar escaneo
        </Button>
      </div>
    </form>
  );
}
