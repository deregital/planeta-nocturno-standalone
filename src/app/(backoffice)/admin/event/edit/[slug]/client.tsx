'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { validateGeneralInformation } from '@/app/(backoffice)/admin/event/create/actions';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import GoBack from '@/components/common/GoBack';
import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';
import { EventOrganizers } from '@/components/event/create/inviteCondition/EventOrganizers';
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateEvent = trpc.events.update.useMutation({
    onSuccess: () => {
      toast.success('¡Evento editado con éxito!');
      router.push('/admin/event');
      setIsSubmitting(false);
    },
    onError: (error) => {
      toast.error(
        error.message ||
          'Error al actualizar el evento. Por favor, intente nuevamente.',
      );
      setError({
        general:
          error.message ||
          'Error al actualizar el evento. Por favor, intente nuevamente.',
      });
      setIsSubmitting(false);
    },
  });

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
        event.eventXorganizers.map((e) => {
          const base = {
            type: event.inviteCondition,
            dni: e.user.dni,
            id: e.user.id,
            fullName: e.user.fullName,
            phoneNumber: e.user.phoneNumber,
          };
          return event.inviteCondition === 'TRADITIONAL'
            ? {
                ...base,
                type: 'TRADITIONAL' as const,
                discountPercentage: e.discountPercentage,
              }
            : {
                ...base,
                type: 'INVITATION' as const,
                ticketAmount: e.ticketAmount,
              };
        }),
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
    setIsSubmitting(true);
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

    if (event.inviteCondition === 'INVITATION' && organizers.length === 0) {
      setError({
        general: 'Debe agregar al menos un organizador para el evento.',
      });
      return;
    }

    updateEvent.mutate({
      event: { ...eventState, id: event.id, slug: event.slug },
      ticketTypes: ticketTypesState,
      organizersInput: organizers,
    });
  }

  if (!event) return null;

  return (
    <div className='w-full p-4 [&_section]:flex [&_section]:flex-col [&_section]:gap-4 [&_section]:p-4 [&_section]:border-2 [&_section]:bg-accent-ultra-light [&_section]:border-stroke [&_section]:rounded-md [&_section]:w-full'>
      <div className='flex gap-2 items-center'>
        <GoBack className='self-baseline' route='/admin/event' />
        <h1 className='text-4xl font-bold'>Editar Evento</h1>
      </div>
      <EventGeneralInformation action='EDIT' externalErrors={error} />
      <section className='my-6' id='ticket-types'>
        <h3 className='text-2xl text-accent font-bold'>Tickets</h3>
        <TicketTypeAction action='EDIT' />
      </section>
      <section className='mb-4'>
        <h3 className='text-2xl text-accent font-bold'>Organizadores</h3>
        <EventOrganizers type={event.inviteCondition} />
      </section>
      {error.general && (
        <p className='text-red-500 font-bold'>{error.general}</p>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant={'accent'}
        className='w-full justify-self-end'
        disabled={isSubmitting}
      >
        Actualizar
      </Button>
    </div>
  );
}
