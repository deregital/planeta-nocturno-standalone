'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { validateGeneralInformation } from '@/app/admin/event/create/actions';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import GoBack from '@/components/common/GoBack';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';
import TicketTypeAction from '@/components/event/create/ticketType/TicketTypeAction';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function Client({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  const router = useRouter();

  const updateEvent = trpc.events.update.useMutation();

  const ticketTypesState = useCreateEventStore((state) => state.ticketTypes);
  const eventState = useCreateEventStore((state) => state.event);
  const setEvent = useCreateEventStore((state) => state.setEvent);
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);

  const [error, setError] = useState<{
    [key: string]: string;
  }>({});

  useEffect(() => {
    if (event) {
      setEvent({
        ...event,
        startingDate: new Date(event.startingDate),
        endingDate: new Date(event.endingDate),
        authorizedUsers: event.eventXUsers.map((e) => ({
          id: e.user.id,
          name: e.user.name,
        })),
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
      toast.error(
        'Error al actualizar el evento. Asegúrese de que los campos no contengan errores.',
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

  return (
    <div className='w-full p-4 [&_section]:flex [&_section]:flex-col [&_section]:gap-4 [&_section]:p-4 [&_section]:border-2 [&_section]:bg-accent-ultra-light [&_section]:border-stroke [&_section]:rounded-md [&_section]:w-full'>
      <div className='flex gap-2 items-center'>
        <GoBack className='self-baseline' />
        <h1 className='text-4xl font-bold'>Editar Evento</h1>
      </div>
      <EventGeneralInformation action='EDIT' externalErrors={error} />
      <section className='my-6' id='ticket-types'>
        <h3 className='text-2xl text-accent font-bold'>Entradas</h3>
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
        Actualizar
      </Button>
    </div>
  );
}
