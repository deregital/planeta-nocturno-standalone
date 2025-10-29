'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import GoBack from '@/components/common/GoBack';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';
import TicketTypeAction from '@/components/event/create/ticketType/TicketTypeAction';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { OrganizerTableWithAction } from '@/components/event/create/inviteCondition/OrganizerTableWithAction';
import { EventOrganizers } from '@/components/event/create/inviteCondition/EventOrganizers';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { validateGeneralInformation } from '@/app/(backoffice)/admin/event/create/actions';

export default function Client({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  const router = useRouter();

  const updateEvent = trpc.events.update.useMutation();

  const ticketTypesState = useCreateEventStore((state) => state.ticketTypes);
  const eventState = useCreateEventStore((state) => state.event);
  const organizers = useCreateEventStore((state) => state.organizers);
  const setEvent = useCreateEventStore((state) => state.setEvent);
  const setTicketTypes = useCreateEventStore((state) => state.setTicketTypes);
  const setOrganizers = useCreateEventStore((state) => state.setOrganizers);

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
      setOrganizers(
        event.eventXorganizers.map((e) => ({
          type: event.inviteCondition,
          dni: e.user.dni,
          id: e.user.id,
          fullName: e.user.fullName,
          phoneNumber: e.user.phoneNumber,
          discountPercentage: e.discountPercentage ?? 0,
          ticketAmount: e.ticketAmount ?? 0,
        })),
      );
      setTicketTypes(
        event.ticketTypes.map((t) => ({
          ...t,
          maxSellDate: t.maxSellDate ? new Date(t.maxSellDate) : new Date(),
          scanLimit: t.scanLimit ? new Date(t.scanLimit) : new Date(),
        })),
      );
    }
  }, [event, setEvent, setOrganizers, setTicketTypes]);

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
      organizersInput: organizers,
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
      <section>
        <h3 className='text-2xl'>Organizadores</h3>
        {event?.inviteCondition === 'TRADITIONAL' ? (
          <EventOrganizers type='TRADITIONAL' />
        ) : (
          <>
            <p className='text-xs text-accent mb-2'>
              En modo invitación no se pueden modificar los organizadores
              después de crear el evento.
            </p>
            <OrganizerTableWithAction
              data={organizers.map((org) => ({
                id: org.id,
                dni: org.dni,
                fullName: org.fullName,
                phoneNumber: org.phoneNumber,
                number:
                  org.type === 'TRADITIONAL'
                    ? org.discountPercentage
                    : org.ticketAmount,
              }))}
              numberTitle='Cantidad de tickets'
              disableActions={true}
              type='INVITATION'
              maxNumber={100}
            >
              <></>
            </OrganizerTableWithAction>
          </>
        )}
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
