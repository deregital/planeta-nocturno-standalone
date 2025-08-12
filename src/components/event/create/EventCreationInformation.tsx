'use client';

import { Button } from '@/components/ui/button';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { useShallow } from 'zustand/react/shallow';
import InputWithLabel from '@/components/common/InputWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { validateGeneralInformation } from '@/app/admin/event/create/actions';
import { useState } from 'react';

export function EventCreationInformation() {
  const { event, setEvent } = useCreateEventStore(
    useShallow((state) => ({
      event: state.event,
      setEvent: state.setEvent,
    })),
  );

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
    }
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
        />
      </section>

      <section>
        <SelectWithLabel
          label='Ubicación'
          id='locationId'
          divClassName='flex-1'
          className='w-full'
          required
          values={[
            {
              label: 'Ubicación 1',
              value: 'ca702912-26ef-42cc-873f-32a7394cc134',
            },
            {
              label: 'Ubicación 2',
              value: 'ca702912-26ef-42cc-873f-32a7394cc125',
            },
          ]}
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
          values={[
            {
              label: 'Categoría 1',
              value: 'ca702912-26ef-42cc-873f-32a7394cc358',
            },
            {
              label: 'Categoría 2',
              value: 'ca702912-26ef-42cc-873f-32a7394cc125',
            },
          ]}
          onValueChange={(value) => {
            setEvent({ categoryId: value });
          }}
          error={error.categoryId}
        />
      </section>

      <Button type='submit' variant={'accent'}>
        Crear evento
      </Button>
    </form>
  );
}
