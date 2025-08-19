'use client';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import TicketTypeAction from '@/components/event/create/ticketType/TicketTypeAction';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { Loader } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { validateGeneralInformation } from '../../create/actions';
import { useCreateEventStore } from '../../create/provider';

export default function Client() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();

  const updateEvent = trpc.events.update.useMutation();

  const { data: event, isLoading } = trpc.events.getBySlug.useQuery(
    params.slug,
  );

  const { data: locations } = trpc.location.getAll.useQuery();
  const { data: categories } = trpc.eventCategory.getAll.useQuery();

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

  const eventWithDates = useMemo(() => {
    if (!event) return null;
    return {
      ...event,
      startingDate: new Date(event.startingDate),
      endingDate: new Date(event.endingDate),
      ticketTypes: event.ticketTypes.map((t) => ({
        ...t,
        maxSellDate: t.maxSellDate ? new Date(t.maxSellDate) : new Date(),
        scanLimit: t.scanLimit ? new Date(t.scanLimit) : new Date(),
      })),
    };
  }, [event]);

  useEffect(() => {
    if (event && eventWithDates) {
      setEvent({
        ...event,
        startingDate: new Date(event.startingDate),
        endingDate: new Date(event.endingDate),
      });
      setTicketTypes(eventWithDates.ticketTypes);
    }
  }, [event, eventWithDates, setEvent, setTicketTypes]);

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

  return isLoading || !event || !eventWithDates ? (
    <Loader />
  ) : (
    <div className='w-full p-4 [&>section]:flex [&>section]:flex-col [&>section]:gap-4 [&>section]:my-6 [&>section]:p-4 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full'>
      <h1 className='text-4xl font-bold'>Editar Evento</h1>
      <section>
        <h3 className='text-2xl'>Descripción general del evento</h3>
        <InputWithLabel
          id='name'
          label='Nombre del evento'
          name='name'
          onChange={(e) => {
            setEvent({ name: e.target.value });
          }}
          error={error.name}
          defaultValue={event.name}
        />
        <InputWithLabel
          id='description'
          label='Descripción del evento'
          onChange={(e) => {
            setEvent({ description: e.target.value });
          }}
          error={error.description}
          defaultValue={event.description}
        />
      </section>
      <section>
        <h3 className='text-2xl'>Fecha y hora</h3>
        <InputWithLabel
          id='startingDate'
          label='Fecha y hora de inicio'
          type='datetime-local'
          onChange={(e) => {
            const date = new Date(e.target.value);
            setEvent({ startingDate: date, endingDate: date });
          }}
          error={error.eventDate}
          defaultValue={new Date(event.startingDate).toISOString().slice(0, 19)}
        />
        <InputWithLabel
          id='endingDate'
          label='Fecha y hora de finalización'
          type='datetime-local'
          min={new Date(event.startingDate).toISOString().slice(0, 19)}
          onChange={(e) => {
            const date = new Date(e.target.value);
            setEvent({ startingDate: date, endingDate: date });
          }}
          defaultValue={new Date(event.endingDate).toISOString().slice(0, 19)}
          error={error.eventDate}
        />
      </section>
      <section>
        <h3 className='text-2xl'>Edad Mínima</h3>
        <div className='flex flex-row'>
          <InputWithLabel
            label='Edad mínima?'
            id='minAgeEnabled'
            type='checkbox'
            className='[&>input]:w-6 items-center'
            placeholder='Edad mínima'
            name='minAgeEnabled'
            onChange={(e) => {
              setEvent({ minAge: e.target.checked ? 0 : null });
            }}
            defaultChecked={event.minAge !== null}
          />
          {eventState.minAge !== null && (
            <InputWithLabel
              label='Edad mínima'
              id='minAge'
              type='number'
              className='flex-1'
              placeholder='Edad mínima'
              name='minAge'
              onChange={(e) => {
                setEvent({ minAge: parseInt(e.target.value) });
              }}
              error={error.minAge}
              defaultValue={event.minAge ?? undefined}
            />
          )}
        </div>
      </section>
      <section>
        <h3 className='text-2xl'>Locación</h3>
        <SelectWithLabel
          label='Ubicación'
          id='locationId'
          divClassName='flex-1'
          className='w-full'
          required
          values={
            locations
              ? locations.map((location) => ({
                  label: `${location.name} (${location.address})`,
                  value: location.id,
                }))
              : []
          }
          onValueChange={(value) => {
            setEvent({ locationId: value });
          }}
          error={error.locationId}
          defaultValue={event.locationId}
        />
      </section>
      <section>
        <h3 className='text-2xl'>Categoría</h3>
        <SelectWithLabel
          label='Categoría'
          id='categoryId'
          divClassName='flex-1'
          className='w-full'
          required
          values={
            categories
              ? categories.map((category) => ({
                  label: category.name,
                  value: category.id,
                }))
              : []
          }
          onValueChange={(value) => {
            setEvent({ categoryId: value });
          }}
          error={error.categoryId}
          defaultValue={event.categoryId}
        />
      </section>
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
