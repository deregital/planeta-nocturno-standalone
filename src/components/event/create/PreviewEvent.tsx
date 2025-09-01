import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';
import TicketTypeList from '@/components/event/create/ticketType/TicketTypeList';

export default function PreviewEvent({ back }: { back: () => void }) {
  const ticketTypes = useCreateEventStore((state) => state.ticketTypes);
  const event = useCreateEventStore((state) => state.event);

  const createEvent = trpc.events.create.useMutation();

  const router = useRouter();

  const handleSubmit = async ({ isActive }: { isActive: boolean }) => {
    try {
      await createEvent.mutateAsync({
        event: { ...event, isActive },
        ticketTypes,
      });
      toast('¡Evento creado con éxito!');
      router.push('/admin/event');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Error desconocido, vuelva a intentarlo.';
      toast(`Error al crear el evento: ${msg}`);
    }
  };

  return (
    <div className='w-full  [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:my-6 [&>section]:p-4 [&>section]:border-2 [&_section]:border-stroke [&_section]:bg-accent-ultra-light [&>section]:rounded-md [&>section]:w-full'>
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
      <div className='flex gap-4 [&_button]:flex-1'>
        <Button
          onClick={() =>
            handleSubmit({
              isActive: false,
            })
          }
          variant={'outline'}
        >
          Crear sin publicar
        </Button>
        <Button
          variant={'accent'}
          className=''
          onClick={() =>
            handleSubmit({
              isActive: true,
            })
          }
        >
          Crear y publicar
        </Button>
      </div>
    </div>
  );
}
