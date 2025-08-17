'use client';

import { validateGeneralInformation } from '@/app/admin/event/create/actions';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { Button } from '@/components/ui/button';
import { trpc } from '@/server/trpc/client';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

export function EventCreationInformation({ next }: { next: () => void }) {
  const { event, setEvent } = useCreateEventStore(
    useShallow((state) => ({
      event: state.event,
      setEvent: state.setEvent,
    })),
  );

  const { data: locations } = trpc.location.getAll.useQuery();
  const { data: categories } = trpc.eventCategory.getAll.useQuery();

  const [minAgeEnabled, setMinAgeEnabled] = useState(false);

  const [error, setError] = useState<{
    [key: string]: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validatedEvent = await validateGeneralInformation(event);

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

    next();
  };

  return (
    <form
      className='flex flex-col gap-4 justify-center [&>section]:flex [&>section]:flex-col [&>section]:gap-2 [&>section]:p-2 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full w-full'
      onSubmit={handleSubmit}
    >
      <ImageUploader />
      <section className='flex flex-col gap-2'>
        <InputWithLabel
          label='Nombre del evento'
          id='name'
          type='text'
          placeholder='Nombre del evento'
          name='name'
          onChange={(e) => {
            setEvent({ name: e.target.value });
          }}
          error={error.name}
          defaultValue={event.name ?? ''}
        />
        <InputWithLabel
          label='Descripción del evento'
          id='description'
          type='text'
          placeholder='Descripción del evento'
          name='description'
          onChange={(e) => {
            setEvent({ description: e.target.value });
          }}
          error={error.description}
          defaultValue={event.description ?? ''}
        />
      </section>
      <section className='md:!flex-row'>
        <InputWithLabel
          label='Fecha del evento'
          id='eventDate'
          type='date'
          className='flex-1'
          placeholder='Fecha del evento'
          name='eventDate'
          value={event.startingDate.toISOString().split('T')[0]}
          onChange={(e) => {
            const date = new Date(e.target.value);
            setEvent({ startingDate: date, endingDate: date });
          }}
          error={error.eventDate}
          defaultValue={
            event.startingDate.toISOString().split('T')[0] ??
            new Date().toISOString().split('T')[0]
          }
        />
        <InputWithLabel
          label='Hora de inicio'
          id='startTime'
          type='time'
          className='flex-1'
          placeholder='Hora de inicio'
          name='startTime'
          value={event.startingDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const newDate = new Date(event.startingDate);
            newDate.setHours(parseInt(hours), parseInt(minutes));

            setEvent({ startingDate: newDate });
          }}
          error={error.startTime}
          defaultValue={
            event.startingDate.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            }) ?? ''
          }
        />
        <InputWithLabel
          label='Hora de fin'
          id='endTime'
          type='time'
          className='flex-1'
          placeholder='Hora de fin'
          name='endTime'
          value={event.endingDate.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const startHours = event.startingDate.getHours();
            const newDate = new Date(event.startingDate);
            newDate.setHours(parseInt(hours), parseInt(minutes));

            // If end time is after midnight and start time isn't, add a day
            if (parseInt(hours) < startHours && parseInt(hours) < 24) {
              newDate.setDate(newDate.getDate() + 1);
            }

            setEvent({ endingDate: newDate });
          }}
          error={error.endTime}
          defaultValue={
            event.endingDate.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            }) ?? ''
          }
        />
      </section>
      <section className='flex !flex-row gap-2'>
        <InputWithLabel
          label='Edad mínima?'
          id='minAgeEnabled'
          type='checkbox'
          className='[&>input]:w-6 items-center'
          placeholder='Edad mínima'
          name='minAgeEnabled'
          checked={minAgeEnabled}
          onChange={(e) => {
            setMinAgeEnabled(e.target.checked);
            setEvent({ minAge: e.target.checked ? 0 : null });
          }}
          defaultValue={event.minAge ? 'true' : 'false'}
        />
        {minAgeEnabled && (
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
      </section>
      <section>
        <InputWithLabel
          label='Activo'
          id='isActive'
          type='checkbox'
          placeholder='Activo'
          name='isActive'
          onChange={(e) => {
            setEvent({ isActive: e.target.checked });
          }}
          error={error.isActive}
          defaultValue={event.isActive.toString() ?? 'false'}
        />
      </section>

      <section>
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
        />
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
        />
      </section>

      <Button type='submit' variant={'accent'}>
        Continuar
      </Button>
    </form>
  );
}
