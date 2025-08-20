'use client';
import TicketTypeAction from '@/components/event/create/ticketType/TicketTypeAction';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { Loader } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { validateGeneralInformation } from '../../create/actions';
import { useCreateEventStore } from '../../create/provider';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';

export default function Client() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const updateEvent = trpc.events.update.useMutation();

  const { data: event, isLoading } = trpc.events.getBySlug.useQuery(
    params.slug,
  );

  const {
    ticketTypes: ticketTypesState,
    event: eventState,
    setEvent,
    setTicketTypes,
  } = useCreateEventStore(
    useShallow((state) => ({
      event: state.event,
      ticketTypes: state.ticketTypes,
      setEvent: state.setEvent,
      setTicketTypes: state.setTicketTypes,
    })),
  );

  const [error, setError] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    if (event) {
      setEvent({
        ...event,
        startingDate: new Date(event.startingDate),
        endingDate: new Date(event.endingDate),
      });
      setTicketTypes(
        event.ticketTypes.map((t) => ({
          ...t,
          maxSellDate: t.maxSellDate ? new Date(t.maxSellDate) : new Date(),
          scanLimit: t.scanLimit ? new Date(t.scanLimit) : new Date(),
        })),
      );
    }
  }, [event, setEvent, setTicketTypes]);

  async function handleSubmit() {
    const validatedEvent = await validateGeneralInformation(eventState);

    if (!validatedEvent.success) {
      const keyAndError = Object.entries(validatedEvent.error ?? {});
      setError(
        keyAndError.reduce(
          (acc, [key, value]) => {
            acc[key] = value.errors[0];
            return acc;
          },
          {} as { [key: string]: string },
        ),
      );
      return;
    }

    if (!event) {
      setError({
        general: 'Hubo un error al actualizar el evento. Intente nuevamente.',
      });
      return;
    }

    updateEvent.mutate({
      event: { ...eventState, id: event.id, slug: event.slug },
      ticketTypes: ticketTypesState,
    });

    toast('¡Evento editado con éxito!');
    router.push('/admin/event');
  }

  return isLoading || !event ? (
    <Loader />
  ) : (
    <div className='w-full p-4 [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:my-6 [&>section]:p-4 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full'>
      <h1 className='text-4xl font-bold'>Editar Evento</h1>
      <EventGeneralInformation action='EDIT' />
      <section>
        <h3 className='text-2xl'>Entradas</h3>
        <TicketTypeAction />
      </section>
      {error.general && (
        <p className='text-red-500 font-bold'>{error.general}</p>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant={'accent'}
        className='w-full justify-self-end'
      >
        Editar evento
      </Button>
    </div>
  );
}
