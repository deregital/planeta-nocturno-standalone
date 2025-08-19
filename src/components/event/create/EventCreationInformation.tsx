'use client';

import { validateGeneralInformation } from '@/app/admin/event/create/actions';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { Button } from '@/components/ui/button';
import { generateS3Url } from '@/lib/utils';
import { trpc } from '@/server/trpc/client';
import { addDays, format } from 'date-fns';
import { toDate } from 'date-fns-tz';
import Image from 'next/image';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

function isBeforeHoursAndMinutes(date1: Date, date2: Date) {
  return (
    date1.getHours() < date2.getHours() ||
    (date1.getHours() === date2.getHours() &&
      date1.getMinutes() < date2.getMinutes())
  );
}

export function EventCreationInformation({ next }: { next: () => void }) {
  const { event, setEvent } = useCreateEventStore(
    useShallow((state) => ({
      event: state.event,
      setEvent: state.setEvent,
    })),
  );

  const { data: locations } = trpc.location.getAll.useQuery();
  const { data: categories } = trpc.eventCategory.getAll.useQuery();

  const [error, setError] = useState<{
    [key: string]: string;
  }>({});

  function handleChange<T extends keyof typeof event>(
    key: T,
    value: (typeof event)[T],
  ) {
    setError((prev) => ({ ...prev, [key]: '' }));
    setEvent({ [key]: value });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
  }

  return (
    <form
      className='flex flex-col gap-4 justify-center [&>section]:flex [&>section]:flex-col [&>section]:gap-2 [&>section]:p-2 [&>section]:border-2 [&>section]:border-pn-gray [&>section]:rounded-md [&>section]:w-full w-full'
      onSubmit={handleSubmit}
    >
      {event.coverImageUrl === '' ? (
        <ImageUploader
          error={error.coverImageUrl}
          onUploadComplete={(objectKey) => {
            handleChange('coverImageUrl', generateS3Url(objectKey));
          }}
        />
      ) : (
        <div className='flex flex-col gap-2'>
          <Image
            width={1000}
            height={1000}
            quality={100}
            src={event.coverImageUrl}
            className='max-h-96 aspect-auto rounded-md w-fit mx-auto max-w-full'
            alt='Event cover'
          />
          <Button
            variant='outline'
            onClick={() => handleChange('coverImageUrl', '')}
          >
            Cambiar imagen
          </Button>
        </div>
      )}
      <section className='flex flex-col gap-2'>
        <InputWithLabel
          label='Nombre del evento'
          id='name'
          type='text'
          placeholder='Nombre del evento'
          name='name'
          onChange={(e) => handleChange('name', e.target.value)}
          error={error.name}
          defaultValue={event.name ?? ''}
        />
        <InputWithLabel
          label='Descripción del evento'
          id='description'
          type='text'
          placeholder='Descripción del evento'
          name='description'
          onChange={(e) => handleChange('description', e.target.value)}
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
          value={format(event.startingDate, 'yyyy-MM-dd')}
          onChange={(e) => {
            if (isNaN(new Date(e.target.value).getTime())) {
              setError({ eventDate: 'Fecha inválida' });
              return;
            }

            const startingDate = toDate(e.target.value);

            const endingDate = new Date(
              isBeforeHoursAndMinutes(event.endingDate, event.startingDate)
                ? addDays(startingDate, 1)
                : startingDate,
            );

            startingDate.setHours(event.startingDate.getHours());
            startingDate.setMinutes(event.startingDate.getMinutes());
            endingDate.setHours(event.endingDate.getHours());
            endingDate.setMinutes(event.endingDate.getMinutes());

            handleChange('startingDate', startingDate);
            handleChange('endingDate', endingDate);
            setError({ eventDate: '' });
          }}
          error={error.eventDate}
          // defaultValue={format(event.startingDate, 'yyyy-MM-dd')}
        />
        <InputWithLabel
          label='Hora de inicio'
          id='startTime'
          type='time'
          className='flex-1'
          placeholder='Hora de inicio'
          name='startTime'
          value={format(event.startingDate, 'HH:mm')}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const newDate = toDate(event.startingDate, {});
            newDate.setHours(parseInt(hours), parseInt(minutes));

            // if the new date is before the ending date, substract a day from the ending date
            if (isBeforeHoursAndMinutes(newDate, event.endingDate)) {
              const newEndingDate = new Date(newDate);
              newEndingDate.setHours(event.endingDate.getHours());
              newEndingDate.setMinutes(event.endingDate.getMinutes());
              handleChange('endingDate', newEndingDate);
            } else {
              const newEndingDate = addDays(event.startingDate, 1);
              newEndingDate.setHours(event.endingDate.getHours());
              newEndingDate.setMinutes(event.endingDate.getMinutes());
              handleChange('endingDate', newEndingDate);
            }

            handleChange('startingDate', newDate);
          }}
          error={error.startingDate}
          // defaultValue={format(event.startingDate, 'HH:mm')}
        />
        <InputWithLabel
          label='Hora de fin'
          id='endTime'
          type='time'
          className='flex-1'
          placeholder='Hora de fin'
          name='endTime'
          value={format(event.endingDate, 'HH:mm')}
          onChange={(e) => {
            const [hours, minutes] = e.target.value.split(':');
            const newDate = toDate(event.startingDate, {});
            newDate.setHours(parseInt(hours), parseInt(minutes));

            if (isBeforeHoursAndMinutes(newDate, event.startingDate)) {
              newDate.setDate(newDate.getDate() + 1);
            }

            handleChange('endingDate', newDate);
          }}
          error={error.endingDate}
          // defaultValue={format(event.endingDate, 'HH:mm')}
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
          checked={event.minAge !== null}
          onChange={(e) => {
            handleChange('minAge', e.target.checked ? 0 : null);
          }}
        />
        {event.minAge !== null && (
          <InputWithLabel
            label='Edad mínima'
            id='minAge'
            type='number'
            className='flex-1'
            placeholder='Edad mínima'
            name='minAge'
            onChange={(e) => {
              handleChange('minAge', parseInt(e.target.value));
            }}
            error={error.minAge}
            defaultValue={isNaN(event.minAge ?? 0) ? undefined : event.minAge!}
          />
        )}
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
            handleChange('locationId', value);
          }}
          error={error.locationId}
          defaultValue={event.locationId}
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
            handleChange('categoryId', value);
          }}
          error={error.categoryId}
          defaultValue={event.categoryId}
        />
      </section>

      <Button type='submit' variant={'accent'}>
        Continuar
      </Button>
    </form>
  );
}
