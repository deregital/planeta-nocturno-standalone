import { useCreateEventStore } from '@/app/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import TicketTypeList from './ticketType/TicketTypeList';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';

export default function PreviewEvent({ back }: { back: () => void }) {
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const event = useCreateEventStore((state) => state.event);
  const setEvent = useCreateEventStore((state) => state.setEvent);

  const createEvent = trpc.events.create.useMutation();

  const router = useRouter();

  const handleSubmit = async () => {
    try {
      await createEvent.mutateAsync({ event, ticketTypes });
      toast('¡Evento creado con éxito!');
      router.push('/admin/event');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast(`UUUH WACHo: ${msg}`);
    }
  };

  return (
    <div className='w-full  [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:my-6 [&>section]:p-4 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full'>
      <Button className='self-baseline' onClick={back} variant={'outline'}>
        Volver
      </Button>
      <h2 className='text-2xl text-center'>Previsualización del evento</h2>
      <EventGeneralInformation action='PREVIEW' />
      <section>
        <h3 className='text-2xl'>Entradas</h3>
        <TicketTypeList
          action='PREVIEW'
          ticketTypes={ticketTypes}
          maxAvailableLeft={0}
        />
      </section>
      <section>
        <h3 className='text-2xl'>Activar la venta de entradas</h3>
        <InputWithLabel
          label='Activo'
          id='isActive'
          type='checkbox'
          placeholder='Activo'
          name='isActive'
          onChange={(e) => {
            setEvent({ isActive: e.target.checked });
          }}
          defaultValue={event.isActive.toString() ?? 'false'}
        />
      </section>
      <Button
        variant={'accent'}
        className='w-full justify-self-end'
        onClick={() => handleSubmit()}
      >
        Crear evento
      </Button>
    </div>
  );
}
