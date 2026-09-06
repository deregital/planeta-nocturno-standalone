'use client';

import { addDays, format } from 'date-fns';
import { toDate } from 'date-fns-tz';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import Resizer from 'react-image-file-resizer';
import { toast } from 'sonner';

import { validateGeneralInformation } from '@/app/(backoffice)/admin/event/create/actions';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { SelectableComboBox } from '@/components/admin/SelectableComboBox';
import EventCategoryModal from '@/components/category/EventCategoryModal';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import MarkdownTextareaWithLabel from '@/components/common/MarkdownTextareaWithLabel';
import SelectWithLabel from '@/components/common/SelectWithLabel';
import { EventCoverSquareCropDialog } from '@/components/event/create/EventCoverSquareCropDialog';
import { EventQuestions } from '@/components/event/create/EventQuestions';
import EventVideoField from '@/components/event/create/EventVideoField';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { TicketingUserModal } from '@/components/event/create/TicketingUserModal';
import { UserBox } from '@/components/event/create/UserBox';
import LocationModal from '@/components/location/LocationModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { generateS3Url } from '@/lib/utils-client';
import { trpc } from '@/server/trpc/client';

/** Lado máximo en px tras el recorte 1:1 (compresión previa a la subida). */
const COVER_SQUARE_MAX_SIDE = 1200;

function pickCoverResizeFormat(file: File): {
  format: string;
  quality: number;
} {
  if (file.type === 'image/png') return { format: 'png', quality: 100 };
  if (file.type === 'image/webp') return { format: 'webp', quality: 92 };
  return { format: 'jpeg', quality: 88 };
}

function prepareEventCoverFile(file: File): Promise<File> {
  const { format, quality } = pickCoverResizeFormat(file);
  return new Promise((resolve, reject) => {
    try {
      Resizer.imageFileResizer(
        file,
        COVER_SQUARE_MAX_SIDE,
        COVER_SQUARE_MAX_SIDE,
        format,
        quality,
        0,
        (output) => {
          if (output instanceof File) resolve(output);
          else reject(new Error('Resize inválido'));
        },
        'file',
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Resize falló'));
    }
  });
}

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

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOriginalName, setCropOriginalName] = useState('portada.jpg');
  const pendingUploadRef = useRef<((f: File) => void) | null>(null);

  const handleCropDialogOpenChange = useCallback((open: boolean) => {
    setCropOpen(open);
    if (!open) {
      setCropSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, []);

  const handleCoverCropped = useCallback(
    (file: File) => {
      pendingUploadRef.current?.(file);
      handleCropDialogOpenChange(false);
    },
    [handleCropDialogOpenChange],
  );

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
      const errors = keyAndError.reduce(
        (acc, [key, value]) => {
          acc[key] = value.errors[0];
          return acc;
        },
        {} as { [key: string]: string },
      );
      setError(errors);
      const firstMessage = Object.values(errors)[0];
      toast.error(
        firstMessage ??
          'Hay errores en el formulario. Revisa los campos marcados.',
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
        <>
          <EventCoverSquareCropDialog
            open={cropOpen}
            onOpenChange={handleCropDialogOpenChange}
            imageSrc={cropSrc}
            originalFileName={cropOriginalName}
            onConfirm={handleCoverCropped}
          />
          <TicketingUserModal
            open={openTicketingUserModal}
            onOpenChange={setOpenTicketingUserModal}
            onSuccess={() => {
              utils.user.getTicketingUsers.invalidate();
            }}
          />
        </>
      )}
      <form
        className='flex flex-col gap-4 justify-center [&>section]:flex [&>section]:flex-col [&>section]:gap-2 [&>section]:p-2 [&>section]:border-2 [&>section]:border-accent [&>section]:bg-accent-ultra-light [&>section]:rounded-md [&>section]:w-full w-full'
        onSubmit={handleSubmit}
      >
        {(action === 'CREATE' || action === 'EDIT') &&
        event.coverImageUrl === '' ? (
          <ImageUploader
            error={error.coverImageUrl}
            prepareInteractive={(file, upload) => {
              pendingUploadRef.current = upload;
              setCropOriginalName(file.name || 'portada.jpg');
              setCropSrc((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return URL.createObjectURL(file);
              });
              setCropOpen(true);
            }}
            prepareFile={prepareEventCoverFile}
            description={{
              maxFiles: undefined,
              fileTypes: 'JPG, JPEG, PNG',
              extra:
                'La portada es cuadrada: al elegir la imagen podés recortarla y ajustar el zoom.',
            }}
            onUploadComplete={(objectKey) => {
              handleChange('coverImageUrl', generateS3Url(objectKey));
            }}
          />
        ) : (
          (action === 'CREATE' || action === 'EDIT') && (
            <div className='mx-auto flex w-full flex-col items-center justify-center gap-3 md:max-w-2xl md:flex-row md:items-start'>
              <div className='flex shrink-0 flex-col items-center justify-center gap-2'>
                <div className='relative aspect-square w-full max-w-40 overflow-hidden rounded-md bg-muted/40'>
                  <Image
                    fill
                    quality={100}
                    src={event.coverImageUrl}
                    className='object-cover'
                    sizes='160px'
                    alt='Portada del evento'
                  />
                </div>
                <Button
                  variant='ghost'
                  className='w-fit'
                  onClick={() => handleChange('coverImageUrl', '')}
                >
                  Cambiar imagen
                </Button>
              </div>
              <EventVideoField
                videoUrl={event.videoUrl}
                error={error.videoUrl}
                onChange={(value) => handleChange('videoUrl', value)}
                slotClassName='w-40 sm:w-48'
                className='self-center md:self-auto'
              />
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
            <MarkdownTextareaWithLabel
              label='Descripción'
              id='description'
              placeholder='Descripción del evento'
              required
              name='description'
              rows={5}
              onChange={(e) => handleChange('description', e.target.value)}
              error={error.description}
              value={event.description ?? ''}
              readOnly={action === 'PREVIEW'}
              disabled={action === 'PREVIEW'}
            />
          </div>
          {action === 'PREVIEW' && (
            <div className='flex shrink-0 items-start gap-2'>
              <div className='relative aspect-square w-full max-w-48 overflow-hidden rounded-md bg-muted/40 md:w-48 md:max-w-none'>
                <Image
                  fill
                  quality={100}
                  src={event.coverImageUrl}
                  className='object-cover'
                  sizes='192px'
                  alt='Portada del evento'
                />
              </div>
              <EventVideoField
                videoUrl={event.videoUrl}
                readOnly
                onChange={() => {}}
                slotClassName='w-40 sm:w-48'
                className='self-center md:self-auto'
              />
            </div>
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
        <section>
          <h3 className='text-accent-dark text-lg font-semibold'>Ubicación</h3>
          {action !== 'PREVIEW' && openLocationModal && (
            <div className='hidden'>
              <LocationModal
                action='CREATE'
                onSuccess={async (createdId) => {
                  await utils.location.getAll.invalidate();
                  if (createdId) {
                    handleChange('locationId', createdId);
                  }
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
                onSuccess={async (createdId) => {
                  await utils.eventCategory.getAll.invalidate();
                  if (createdId) {
                    handleChange('categoryId', createdId);
                  }
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
          <input type='hidden' name='locationId' value={event.locationId} />
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
                onUserUpdated={(updatedName) => {
                  handleChange(
                    'authorizedUsers',
                    event.authorizedUsers.map((u) =>
                      u.id === user.id ? { ...u, name: updatedName } : u,
                    ),
                  );
                  utils.user.getTicketingUsers.invalidate();
                }}
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
        <Accordion type='multiple' className='w-full'>
          <AccordionItem value='buyer-extra-data' className='border-none'>
            <AccordionTrigger
              className='bg-transparent text-accent-dark px-0 py-2.5 text-sm font-semibold hover:no-underline hover:bg-transparent'
              chevronClassName='text-accent-dark'
            >
              Solicitar datos adicionales al comprador
            </AccordionTrigger>
            <AccordionContent
              contentClassName='w-full ml-0 mt-0 border-none rounded-none'
              className='flex flex-col gap-2 bg-transparent p-0 pt-1 pb-3'
            >
              <div className='flex flex-col gap-1.5 p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'>
                <label
                  htmlFor='minAgeEnabled'
                  className='flex items-start gap-2.5 cursor-pointer'
                >
                  <input
                    id='minAgeEnabled'
                    type='checkbox'
                    name='minAgeEnabled'
                    disabled={action === 'PREVIEW'}
                    checked={event.minAge !== null}
                    onChange={(e) => {
                      if (action === 'PREVIEW') return;
                      handleChange('minAge', e.target.checked ? 0 : null);
                    }}
                    className='mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed'
                  />
                  <span className='flex flex-col gap-0.5'>
                    <span className='text-sm text-accent-dark'>
                      Edad mínima
                    </span>
                    <span className='text-xs text-accent-dark/70'>
                      Requiere una edad mínima para comprar.
                    </span>
                  </span>
                </label>
                {event.minAge !== null && (
                  <div className='ml-6 max-w-28'>
                    <Input
                      id='minAge'
                      type='number'
                      placeholder='Edad'
                      name='minAge'
                      onChange={(e) => {
                        handleChange('minAge', parseInt(e.target.value));
                      }}
                      defaultValue={
                        isNaN(event.minAge ?? 0) ? undefined : event.minAge!
                      }
                      readOnly={action === 'PREVIEW'}
                      disabled={action === 'PREVIEW'}
                      className='h-8'
                    />
                    {error.minAge && (
                      <p className='pl-1 font-bold text-xs text-red-500'>
                        {error.minAge}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {action !== 'PREVIEW' && (
                <div className='flex flex-col gap-1.5 p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'>
                  <p className='text-sm text-accent-dark'>
                    Preguntas del formulario
                  </p>
                  <p className='text-xs text-accent-dark/70'>
                    Preguntas opcionales de texto libre en el checkout.
                  </p>
                  <EventQuestions embedded showNavigation={false} />
                </div>
              )}

              <label
                htmlFor='hasSimpleInvitation'
                className='flex items-start gap-2.5 cursor-pointer p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'
              >
                <input
                  id='hasSimpleInvitation'
                  type='checkbox'
                  name='hasSimpleInvitation'
                  disabled={action === 'PREVIEW'}
                  checked={event.hasSimpleInvitation}
                  onChange={(e) => {
                    if (action === 'PREVIEW') return;
                    handleChange('hasSimpleInvitation', e.target.checked);
                  }}
                  className='mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed'
                />
                <span className='flex flex-col gap-0.5'>
                  <span className='text-sm text-accent-dark'>
                    Campo &quot;Invita&quot;
                  </span>
                  <span className='text-xs text-accent-dark/70'>
                    Pide quién invitó al comprador.
                  </span>
                </span>
              </label>

              <label
                htmlFor='extraTicketData'
                className='flex items-start gap-2.5 cursor-pointer p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'
              >
                <input
                  id='extraTicketData'
                  type='checkbox'
                  name='extraTicketData'
                  disabled={action === 'PREVIEW'}
                  checked={event.extraTicketData}
                  onChange={(e) => {
                    if (action === 'PREVIEW') return;
                    handleChange('extraTicketData', e.target.checked);
                  }}
                  className='mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed'
                />
                <span className='flex flex-col gap-0.5'>
                  <span className='text-sm text-accent-dark'>
                    Datos múltiples por ticket
                  </span>
                  <span className='text-xs text-accent-dark/70'>
                    Datos personales en cada ticket, no solo una vez por compra.
                  </span>
                </span>
              </label>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value='event-extra-config' className='border-none'>
            <AccordionTrigger
              className='bg-transparent text-accent-dark px-0 py-2.5 text-sm font-semibold hover:no-underline hover:bg-transparent'
              chevronClassName='text-accent-dark'
            >
              Configuración adicional del evento
            </AccordionTrigger>
            <AccordionContent
              contentClassName='w-full ml-0 mt-0 border-none rounded-none'
              className='flex flex-col gap-2 bg-transparent p-0 pt-1 pb-3'
            >
              <div className='flex flex-col gap-1.5 p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'>
                <SelectWithLabel
                  label='Categoría'
                  id='categoryId'
                  divClassName='flex-1'
                  className='w-full'
                  values={[
                    {
                      label: 'Sin categoría',
                      value: 'NONE',
                    },
                    ...(categories
                      ? categories.map((category) => ({
                          label: category.name,
                          value: category.id,
                        }))
                      : []),
                    {
                      label: '+ Crear categoría',
                      value: 'CREATE_NEW',
                    },
                  ]}
                  onValueChange={(value) => {
                    if (value === 'CREATE_NEW') {
                      setOpenCategoryModal(true);
                      return;
                    }

                    if (value === 'NONE' || value === '') {
                      handleChange('categoryId', null);
                      return;
                    }

                    handleChange('categoryId', value);
                  }}
                  error={error.categoryId}
                  value={event.categoryId ?? 'NONE'}
                  readOnly={action === 'PREVIEW'}
                  disabled={action === 'PREVIEW'}
                />
                <input
                  type='hidden'
                  name='categoryId'
                  value={event.categoryId ?? ''}
                />
                <p className='text-xs text-accent-dark/70'>
                  Opcional. Ayuda a organizar y filtrar eventos.
                </p>
              </div>

              <div className='flex flex-col gap-1.5 p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'>
                <p className='text-sm text-accent-dark'>Notificaciones</p>
                <Input
                  id='emailNotification'
                  type='email'
                  placeholder='correo@ejemplo.com'
                  name='emailNotification'
                  value={event.emailNotification ?? ''}
                  onChange={(e) =>
                    handleChange('emailNotification', e.target.value)
                  }
                  readOnly={action === 'PREVIEW'}
                  disabled={action === 'PREVIEW'}
                  className='h-8'
                />
                {error.emailNotification && (
                  <p className='pl-1 font-bold text-xs text-red-500'>
                    {error.emailNotification}
                  </p>
                )}
                <p className='text-xs text-accent-dark/70'>
                  Correo opcional para avisar cuando se emitan tickets.
                </p>
              </div>

              <div className='flex flex-col gap-1.5 p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'>
                <label
                  htmlFor='serviceFeeEnabled'
                  className='flex items-start gap-2.5 cursor-pointer'
                >
                  <input
                    id='serviceFeeEnabled'
                    type='checkbox'
                    name='serviceFeeEnabled'
                    disabled={action === 'PREVIEW'}
                    checked={event.serviceFee !== null}
                    onChange={(e) => {
                      if (action === 'PREVIEW') return;
                      handleChange('serviceFee', e.target.checked ? 0 : null);
                    }}
                    className='mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed'
                  />
                  <span className='flex flex-col gap-0.5'>
                    <span className='text-sm text-accent-dark'>
                      Cargo por servicio
                    </span>
                    <span className='text-xs text-accent-dark/70'>
                      Porcentaje extra sobre el total de tickets.
                    </span>
                  </span>
                </label>
                {event.serviceFee !== null && (
                  <div className='ml-6 max-w-36'>
                    <Input
                      id='serviceFee'
                      type='number'
                      name='serviceFee'
                      placeholder='%'
                      value={event.serviceFee ?? 0}
                      min={0}
                      max={100}
                      onChange={(e) =>
                        handleChange('serviceFee', Number(e.target.value))
                      }
                      readOnly={action === 'PREVIEW'}
                      disabled={action === 'PREVIEW'}
                      className='h-8'
                    />
                    {error.serviceFee && (
                      <p className='pl-1 font-bold text-xs text-red-500'>
                        {error.serviceFee}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <label
                htmlFor='ticketSlugVisibleInPdf'
                className='flex items-start gap-2.5 cursor-pointer p-2 border-2 border-accent bg-accent-ultra-light rounded-md w-full'
              >
                <input
                  id='ticketSlugVisibleInPdf'
                  type='checkbox'
                  name='ticketSlugVisibleInPdf'
                  disabled={action === 'PREVIEW'}
                  checked={event.ticketSlugVisibleInPdf}
                  onChange={(e) => {
                    if (action === 'PREVIEW') return;
                    handleChange('ticketSlugVisibleInPdf', e.target.checked);
                  }}
                  className='mt-0.5 size-4 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed'
                />
                <span className='flex flex-col gap-0.5'>
                  <span className='text-sm text-accent-dark'>
                    Mostrar identificador único en ticket
                  </span>
                  <span className='text-xs text-accent-dark/70'>
                    Incluye el ID en el PDF (ej. free-1).
                  </span>
                </span>
              </label>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {action === 'CREATE' && (
          <Button type='submit' variant={'accent'}>
            Continuar
          </Button>
        )}
      </form>
    </>
  );
}
