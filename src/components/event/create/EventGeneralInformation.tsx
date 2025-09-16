'use client';

import { addDays, format } from 'date-fns';
import { toDate } from 'date-fns-tz';
import Image from 'next/image';
import { useState } from 'react';

import { validateGeneralInformation } from '@/app/admin/event/create/actions';
import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { UserBox } from '@/components/event/create/UserBox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { generateS3Url } from '@/lib/utils-client';
import { trpc } from '@/server/trpc/client';

function isBeforeHoursAndMinutes(date1: Date, date2: Date) {
  return (
    date1.getHours() < date2.getHours() ||
    (date1.getHours() === date2.getHours() &&
      date1.getMinutes() < date2.getMinutes())
  );
}

type EventGeneralInformationProps =
  | {
      action: 'CREATE';
      next: () => void;
    }
  | {
      action: 'EDIT' | 'PREVIEW';
      next?: never;
    };

export function EventGeneralInformation({
  action,
  next,
}: EventGeneralInformationProps) {
  const event = useCreateEventStore((state) => state.event);
  const setEvent = useCreateEventStore((state) => state.setEvent);

  const { data: locations } = trpc.location.getAll.useQuery();
  const { data: categories } = trpc.eventCategory.getAll.useQuery();
  const { data: users } = trpc.user.getTicketingUsers.useQuery();

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

    if (action === 'CREATE') {
      next();
    }
  }

  return (
    <form
      className='flex flex-col gap-4 justify-center [&>section]:flex [&>section]:flex-col [&>section]:gap-2 [&>section]:p-2 [&>section]:border-2 [&>section]:border-accent [&>section]:bg-accent-ultra-light [&>section]:rounded-md [&>section]:w-full w-full'
      onSubmit={handleSubmit}
    >
      {(action === 'CREATE' || action === 'EDIT') &&
      event.coverImageUrl === '' ? (
        <ImageUploader
          error={error.coverImageUrl}
          onUploadComplete={(objectKey) => {
            handleChange('coverImageUrl', generateS3Url(objectKey));
          }}
        />
      ) : (
        (action === 'CREATE' || action === 'EDIT') && (
          <div className='flex flex-col gap-2 w-fit mx-auto'>
            <Image
              width={1000}
              height={1000}
              quality={100}
              src={event.coverImageUrl}
              className='max-h-64 aspect-auto rounded-md w-fit max-w-full'
              alt='Event cover'
            />
            <Button
              variant='outline'
              onClick={() => handleChange('coverImageUrl', '')}
            >
              Cambiar imagen
            </Button>
          </div>
        )
      )}
      <section
        className={cn(
          'flex flex-col gap-2 w-full',
          action === 'PREVIEW' &&
            'md:!flex-row [&>input]:flex-1 items-center md:items-start',
        )}
      >
        <div className='flex-1 flex flex-col gap-2 w-full'>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Descripción general del evento
          </h3>
          <InputWithLabel
            label='Nombre del evento'
            id='name'
            type='text'
            placeholder='Nombre del evento'
            name='name'
            required
            onChange={(e) => handleChange('name', e.target.value)}
            error={error.name}
            defaultValue={event.name ?? ''}
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
          <InputWithLabel
            label='Descripción del evento'
            id='description'
            type='text'
            placeholder='Descripción del evento'
            required
            name='description'
            onChange={(e) => handleChange('description', e.target.value)}
            error={error.description}
            defaultValue={event.description ?? ''}
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
        </div>
        {action === 'PREVIEW' && (
          <Image
            width={1000}
            height={1000}
            quality={100}
            src={event.coverImageUrl}
            className='max-h-48 aspect-auto rounded-md w-fit max-w-full'
            alt='Event cover'
          />
        )}
      </section>
      <section>
        <h3 className='text-accent-dark text-lg font-semibold'>
          Descripción general del evento
        </h3>
        <div className='flex flex-col gap-2 md:!flex-row'>
          <InputDateWithLabel
            label='Fecha del evento'
            id='eventDate'
            selected={event.startingDate}
            className='flex-1'
            required
            onChange={(date) => {
              const startingDate = date;

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
            disabled={action === 'PREVIEW'}
          />
          <InputWithLabel
            label='Hora de inicio'
            id='startTime'
            type='time'
            required
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
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
          <InputWithLabel
            label='Hora de fin'
            id='endTime'
            type='time'
            required
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
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
        </div>
      </section>
      <section className='flex !flex-row gap-2'>
        <InputWithLabel
          label='Edad mínima?'
          id='minAgeEnabled'
          disabled={action === 'PREVIEW'}
          type='checkbox'
          className='[&>input]:w-6 items-center'
          placeholder='Edad mínima'
          name='minAgeEnabled'
          checked={event.minAge !== null}
          onChange={(e) => {
            if (action === 'PREVIEW') return;
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
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
        )}
      </section>
      <section>
        <h3 className='text-accent-dark text-lg font-semibold'>
          Ubicación y categoría
        </h3>
        <SelectWithLabel
          label='Locación'
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
            if (value === '') return;
            handleChange('locationId', value);
          }}
          error={error.locationId}
          defaultValue={event.locationId}
          value={event.locationId}
          readOnly={action === 'PREVIEW'}
          disabled={action === 'PREVIEW'}
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
            if (value === '') return;
            handleChange('categoryId', value);
          }}
          error={error.categoryId}
          defaultValue={event.categoryId}
          value={event.categoryId}
          readOnly={action === 'PREVIEW'}
          disabled={action === 'PREVIEW'}
        />
      </section>
      <section>
        <h3 className='text-accent-dark text-lg font-semibold'>
          Usuarios autorizados
        </h3>
        <div>
          {action !== 'PREVIEW' && (
            <SelectableComboBox
              list={
                users
                  ? users
                      .filter(
                        (user) => !event.authorizedUsersId.includes(user.id),
                      )
                      .map((user) => ({
                        id: user.id,
                        name: user.name,
                        type: 'EVENT' as const,
                      }))
                  : []
              }
              onSelectAction={(user) => {
                handleChange('authorizedUsersId', [
                  ...event.authorizedUsersId,
                  user.id,
                ]);
              }}
              title='Agregar'
              listOf='usuario'
            />
          )}
          {error.authorizedUsersId && (
            <p className='text-red-500 text-sm'>{error.authorizedUsersId}</p>
          )}
        </div>
        <div className='flex gap-2'>
          {event.authorizedUsersId?.map((userId) => (
            <UserBox
              key={userId}
              id={userId}
              name={users?.find((user) => user.id === userId)?.name ?? ''}
              remove={() => {
                handleChange(
                  'authorizedUsersId',
                  event.authorizedUsersId.filter((id) => id !== userId),
                );
              }}
              disabled={action === 'PREVIEW'}
            />
          ))}
        </div>
        <p className='text-sm'>
          Los usuarios autorizados podrán{' '}
          <span className='font-bold'>ver el evento</span> hasta la fecha de
          finalización, <span className='font-bold'>emitir tickets</span> y{' '}
          <span className='font-bold'>escanear entradas</span>.
        </p>
      </section>
      {action === 'CREATE' && (
        <Button type='submit' variant={'accent'}>
          Continuar
        </Button>
      )}
    </form>
  );
}
