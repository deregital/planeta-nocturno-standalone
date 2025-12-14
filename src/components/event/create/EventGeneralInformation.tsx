'use client';

import { addDays, format } from 'date-fns';
import { toDate } from 'date-fns-tz';
import Image from 'next/image';
import { useState } from 'react';

import { validateGeneralInformation } from '@/app/(backoffice)/admin/event/create/actions';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import EventCategoryModal from '@/components/category/EventCategoryModal';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { TicketingUserModal } from '@/components/event/create/TicketingUserModal';
import { UserBox } from '@/components/event/create/UserBox';
import LocationModal from '@/components/location/LocationModal';
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
      externalErrors?: { [key: string]: string };
    }
  | {
      action: 'EDIT' | 'PREVIEW';
      next?: never;
      externalErrors?: { [key: string]: string };
    };

export function EventGeneralInformation({
  action,
  next,
  externalErrors,
}: EventGeneralInformationProps) {
  const event = useCreateEventStore((state) => state.event);
  const setEvent = useCreateEventStore((state) => state.setEvent);
  const utils = trpc.useUtils();

  const { data: locations } = trpc.location.getAll.useQuery();
  const { data: categories } = trpc.eventCategory.getAll.useQuery();
  const { data: users } = trpc.user.getTicketingUsers.useQuery();

  const [openLocationModal, setOpenLocationModal] = useState(false);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);

  const [errorMessages, setError] = useState<{
    [key: string]: string;
  }>({});
  const [openTicketingUserModal, setOpenTicketingUserModal] = useState(false);

  const error = { ...errorMessages, ...(externalErrors ?? {}) };

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
    <>
      {action !== 'PREVIEW' && (
        <TicketingUserModal
          open={openTicketingUserModal}
          onOpenChange={setOpenTicketingUserModal}
          onSuccess={() => {
            utils.user.getTicketingUsers.invalidate();
          }}
        />
      )}
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
              'md:flex-row! [&>input]:flex-1 items-center md:items-start',
          )}
        >
          <div className='flex-1 flex flex-col gap-2 w-full'>
            <h3 className='text-accent-dark text-lg font-semibold'>
              Descripción general del evento
            </h3>
            <InputWithLabel
              label='Nombre'
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
              label='Descripción'
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
            Fecha y hora
          </h3>
          <div className='flex flex-col gap-2 md:flex-row!'>
            <InputDateWithLabel
              label='Fecha'
              id='eventDate'
              selected={event.startingDate}
              className='flex-1 max-h-min'
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
              label='Inicio'
              id='startTime'
              type='time'
              required
              className='flex-1'
              placeholder='Hora de inicio'
              name='startTime'
              value={format(event.startingDate, 'HH:mm')}
              onChange={(e) => {
                if (!e.target.value) {
                  return;
                }

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
              label='Finalización'
              id='endTime'
              type='time'
              required
              className='flex-1'
              placeholder='Hora de finalización'
              name='endTime'
              value={format(event.endingDate, 'HH:mm')}
              onChange={(e) => {
                if (!e.target.value) {
                  return;
                }

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
          <span className='text-xs text-accent-dark ml-2'>
            El evento comenzará el{' '}
            <b>{format(event.startingDate, 'dd/MM/yyyy')}</b> a las{' '}
            <b>{format(event.startingDate, 'HH:mm a')}</b> y finalizará el{' '}
            <b>{format(event.endingDate, 'dd/MM/yyyy')}</b> a las{' '}
            <b>{format(event.endingDate, 'HH:mm a')}</b>
          </span>
        </section>
        <section className='flex gap-2'>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Edad mínima
          </h3>
          <div className='flex flex-row! gap-2'>
            <InputWithLabel
              label='¿Edad mínima?'
              id='minAgeEnabled'
              disabled={action === 'PREVIEW'}
              type='checkbox'
              className='[&>input]:w-6 [&>input]:ml-4'
              placeholder='Edad mínima'
              name='minAgeEnabled'
              checked={event.minAge !== null}
              onChange={(e) => {
                if (action === 'PREVIEW') return;
                handleChange('minAge', e.target.checked ? 0 : null);
              }}
            />
            {event.minAge !== null && (
              <div className='flex items-end flex-1'>
                <InputWithLabel
                  label=''
                  id='minAge'
                  type='number'
                  placeholder='Edad mínima'
                  name='minAge'
                  onChange={(e) => {
                    handleChange('minAge', parseInt(e.target.value));
                  }}
                  error={error.minAge}
                  defaultValue={
                    isNaN(event.minAge ?? 0) ? undefined : event.minAge!
                  }
                  readOnly={action === 'PREVIEW'}
                  disabled={action === 'PREVIEW'}
                />
              </div>
            )}
          </div>
        </section>
        <section className='flex gap-2'>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Datos múltiples por ticket
          </h3>
          <InputWithLabel
            label='Pedir datos personales en todos los tickets'
            id='extraTicketData'
            disabled={action === 'PREVIEW'}
            type='checkbox'
            className='[&>input]:w-6 [&>input]:ml-4'
            placeholder='Datos extra de ticket'
            name='extraTicketData'
            checked={event.extraTicketData}
            onChange={(e) => {
              if (action === 'PREVIEW') return;
              handleChange('extraTicketData', e.target.checked);
            }}
          />
          <p className='text-sm'>
            Al seleccionar esta opción, se pedirán los datos personales en cada
            ticket a emitir. Si se deja desmarcada, los datos personales se
            pedirán una sola vez por compra.
          </p>
        </section>
        <section>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Ubicación y categoría
          </h3>
          {action !== 'PREVIEW' && openLocationModal && (
            <div className='hidden'>
              <LocationModal
                action='CREATE'
                onSuccess={() => {
                  utils.location.getAll.invalidate();
                }}
                openController={setOpenLocationModal}
                open={openLocationModal}
              />
            </div>
          )}
          {action !== 'PREVIEW' && openCategoryModal && (
            <div className='hidden'>
              <EventCategoryModal
                action='CREATE'
                onSuccess={() => {
                  utils.eventCategory.getAll.invalidate();
                }}
                openController={setOpenCategoryModal}
                open={openCategoryModal}
              />
            </div>
          )}
          <SelectWithLabel
            label='Locación'
            id='locationId'
            divClassName='flex-1'
            className='w-full'
            required
            values={
              locations
                ? locations
                    .map((location) => ({
                      label: `${location.name} (${location.address})`,
                      value: location.id,
                    }))
                    .concat([
                      {
                        label: '+ Crear locación',
                        value: 'CREATE_NEW',
                      },
                    ])
                : []
            }
            onValueChange={(value) => {
              if (value === 'CREATE_NEW') {
                setOpenLocationModal(true);
                return;
              }

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
                ? categories
                    .map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))
                    .concat([
                      {
                        label: '+ Crear categoría',
                        value: 'CREATE_NEW',
                      },
                    ])
                : []
            }
            onValueChange={(value) => {
              if (value === 'CREATE_NEW') {
                setOpenCategoryModal(true);
                return;
              }

              if (value === '') return;
              handleChange('categoryId', value);
            }}
            error={error.categoryId}
            defaultValue={event.categoryId}
            value={event.categoryId}
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
          <p className='text-sm'>
            La categoría del evento ayuda a organizar y filtrar eventos en el
            sistema.
          </p>
        </section>
        <section>
          <h3 className='text-accent-dark text-lg font-semibold'>Acceso</h3>
          <div>
            {action !== 'PREVIEW' && (
              <SelectableComboBox
                createOption={{
                  label: '+ Crear usuario Acceso',
                  onClick: () => setOpenTicketingUserModal(true),
                }}
                list={
                  users
                    ? users
                        .filter(
                          (user) =>
                            !event.authorizedUsers
                              .map((u) => u.id)
                              .includes(user.id),
                        )
                        .map((user) => ({
                          id: user.id,
                          name: user.name,
                          type: 'EVENT' as const,
                        }))
                    : []
                }
                onSelectAction={(user) => {
                  handleChange('authorizedUsers', [
                    ...event.authorizedUsers,
                    { id: user.id, name: user.name || '' },
                  ]);
                }}
                title='Agregar'
                listOf='usuario'
              />
            )}
            {errorMessages.authorizedUsersId && (
              <p className='text-red-500 text-sm'>
                {errorMessages.authorizedUsersId}
              </p>
            )}
          </div>
          <div className='flex gap-2'>
            {event.authorizedUsers?.map((user) => (
              <UserBox
                key={user.id}
                id={user.id}
                name={user.name}
                remove={() => {
                  handleChange(
                    'authorizedUsers',
                    event.authorizedUsers.filter((u) => u.id !== user.id),
                  );
                }}
                disabled={action === 'PREVIEW'}
              />
            ))}
            {event.authorizedUsers.length === 0 && (
              <p className='text-sm'>No hay usuarios Acceso</p>
            )}
          </div>
          <p className='text-sm'>
            Los usuarios &quot;Acceso&quot; podrán{' '}
            <span className='font-bold'>ver el evento</span> hasta la fecha de
            finalización, <span className='font-bold'>emitir tickets</span> y{' '}
            <span className='font-bold'>escanear tickets</span>.
          </p>
        </section>
        <section>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Notificaciones
          </h3>
          <InputWithLabel
            label='Correo electrónico (opcional)'
            id='emailNotification'
            type='email'
            placeholder='correo@ejemplo.com'
            name='emailNotification'
            value={event.emailNotification ?? ''}
            onChange={(e) => handleChange('emailNotification', e.target.value)}
            error={error.emailNotification}
            readOnly={action === 'PREVIEW'}
            disabled={action === 'PREVIEW'}
          />
          <p className='text-sm'>
            Se enviarán notificaciones a este correo electrónico cuando se
            emitan tickets. Si se deja vacío, no se enviarán notificaciones.
          </p>
        </section>
        <section>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Cargo por servicio
          </h3>
          <div className='flex flex-row! gap-2'>
            <InputWithLabel
              label='¿Cargo por servicio?'
              id='serviceFeeEnabled'
              disabled={action === 'PREVIEW'}
              type='checkbox'
              className='[&>input]:w-6 [&>input]:ml-4'
              placeholder='Cargo por servicio'
              name='serviceFeeEnabled'
              checked={event.serviceFee !== null}
              onChange={(e) => {
                if (action === 'PREVIEW') return;
                handleChange('serviceFee', e.target.checked ? 0 : null);
              }}
            />
            {event.serviceFee !== null && (
              <InputWithLabel
                label='Cargo por servicio %'
                id='serviceFee'
                type='number'
                name='serviceFee'
                value={event.serviceFee ?? 0}
                min={0}
                max={100}
                onChange={(e) =>
                  handleChange('serviceFee', Number(e.target.value))
                }
                error={error.serviceFee}
                readOnly={action === 'PREVIEW'}
                disabled={action === 'PREVIEW'}
              />
            )}
          </div>
          <p className='text-sm'>
            El cargo por servicio se calculará sobre el precio total de los
            tickets. Si se desmarca la opción, no se agregará ningún cargo por
            servicio.
          </p>
        </section>
        <section className='flex gap-2'>
          <h3 className='text-accent-dark text-lg font-semibold'>
            Mostrar identificador único en ticket
          </h3>
          <InputWithLabel
            label='¿Identificador único en ticket?'
            id='ticketSlugVisibleInPdf'
            disabled={action === 'PREVIEW'}
            type='checkbox'
            className='[&>input]:w-6 [&>input]:ml-4'
            placeholder='Datos extra de ticket'
            name='ticketSlugVisibleInPdf'
            checked={event.ticketSlugVisibleInPdf}
            onChange={(e) => {
              if (action === 'PREVIEW') return;
              handleChange('ticketSlugVisibleInPdf', e.target.checked);
            }}
          />
          <p className='text-sm'>
            Al seleccionar esta opción, se mostrará el identificador único en el
            PDF de ticket. El identificador se compone del tipo de ticket
            seguido de un numero. Ej. free-1. Si se deja desmarcada, no se
            mostrará.
          </p>
        </section>
        {action === 'CREATE' && (
          <Button type='submit' variant={'accent'}>
            Continuar
          </Button>
        )}
      </form>
    </>
  );
}
