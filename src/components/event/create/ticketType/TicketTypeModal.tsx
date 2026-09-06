import { format } from 'date-fns';
import { CircleHelp, Loader2, Pencil } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';

import { validateTicketType } from '@/app/(backoffice)/admin/event/create/actions';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { type EventState } from '@/app/(backoffice)/admin/event/create/state';
import { FormRow } from '@/components/common/FormRow';
import InputDateWithLabel from '@/components/common/InputDateWithLabel';
import InputWithLabel from '@/components/common/InputWithLabel';
import { ImageUploader } from '@/components/event/create/ImageUploader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ticketTypesTranslation } from '@/lib/translations';
import { generateS3Url } from '@/lib/utils-client';
import { type CreateTicketTypeSchema } from '@/server/schemas/ticket-type';
import { trpc } from '@/server/trpc/client';
import { type TicketTypeCategory } from '@/server/types';

type TicketTypeModalProps = {
  category: TicketTypeCategory;
  maxAvailableLeft: number;
  action: 'CREATE' | 'EDIT';
  ticketType?: EventState['ticketTypes'][number];
  mercadoPagoEnabled?: boolean | undefined;
};

export default function TicketTypeModal({
  category,
  maxAvailableLeft,
  action,
  ticketType,
  mercadoPagoEnabled,
}: TicketTypeModalProps) {
  const { text, icon } = ticketTypesTranslation[category];
  const requiresMercadoPago = category === 'PAID' || category === 'TABLE';
  const isCreateDisabled =
    action === 'CREATE' && requiresMercadoPago && mercadoPagoEnabled === false;
  const [error, setError] = useState<{
    [key: string]: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [open, setOpen] = useState(false);
  const maxAvailableLeftReal = useMemo(() => {
    if (!ticketType) return maxAvailableLeft;
    return maxAvailableLeft + ticketType.maxAvailable;
  }, [maxAvailableLeft, ticketType]);

  const addTicketType = useCreateEventStore((state) => state.addTicketType);
  const updateTicketType = useCreateEventStore(
    (state) => state.updateTicketType,
  );
  const event = useCreateEventStore((state) => state.event);
  const { data: organizersData } = trpc.user.getOrganizers.useQuery();

  // Initialize editing state based on props
  function getInitialState(): CreateTicketTypeSchema {
    if (ticketType) {
      return {
        name: ticketType.name || '',
        description: ticketType.description || '',
        price: ticketType.price,
        maxPerPurchase: ticketType.maxPerPurchase || 6,
        maxAvailable: ticketType.maxAvailable || 0,
        maxSellDate: ticketType.maxSellDate || event.endingDate,
        scanLimit: ticketType.scanLimit || event.endingDate,
        startingDate: ticketType.startingDate || event.startingDate,
        category,
        id: ticketType.id,
        visibleInWeb: ticketType.visibleInWeb,
        lowStockThreshold: ticketType.lowStockThreshold,
        imageUrl: ticketType.imageUrl ?? null,
        organizers: ticketType.organizers || [],
        allowMultipleScans: ticketType.allowMultipleScans ?? false,
      };
    }
    return {
      name: '',
      description: '',
      price: category === 'FREE' ? 0 : null,
      maxPerPurchase: 6,
      maxAvailable: 0,
      maxSellDate: event.endingDate,
      scanLimit: event.endingDate,
      startingDate: event.startingDate,
      category,
      id: crypto.randomUUID(),
      visibleInWeb: true,
      lowStockThreshold: null,
      imageUrl: null,
      organizers: [],
      allowMultipleScans: false,
    };
  }

  const [editingTicketType, setEditingTicketType] =
    useState<CreateTicketTypeSchema>(getInitialState);

  useEffect(() => {
    setEditingTicketType(getInitialState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.startingDate, event.endingDate]);

  const [hasScanLimit, setHasScanLimit] = useState(
    ticketType?.scanLimit !== event.endingDate,
  );
  const [hasMaxSellDate, setHasMaxSellDate] = useState(
    ticketType?.maxSellDate !== event.endingDate,
  );
  const [hasStartingDate, setHasStartingDate] = useState(
    ticketType?.startingDate !== event.startingDate,
  );

  const [hasLowStockThreshold, setHasLowStockThreshold] = useState(
    ticketType?.lowStockThreshold !== undefined &&
      ticketType?.lowStockThreshold !== null,
  );

  function handleInputChange<T extends keyof CreateTicketTypeSchema>(
    field: T,
    value: CreateTicketTypeSchema[T],
  ) {
    setEditingTicketType((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleScanLimitToggle(checked: boolean) {
    setHasScanLimit(checked);
    if (!checked) {
      setEditingTicketType((prev) => ({
        ...prev,
        scanLimit: event.endingDate,
      }));
    }
  }

  function handleMaxSellDateToggle(checked: boolean) {
    setHasMaxSellDate(checked);
    if (!checked) {
      setEditingTicketType((prev) => ({
        ...prev,
        maxSellDate: event.endingDate,
      }));
    }
  }

  function handleStartingDateToggle(checked: boolean) {
    setHasStartingDate(checked);
    if (!checked) {
      setEditingTicketType((prev) => ({
        ...prev,
        startingDate: event.startingDate,
      }));
    }
  }

  function handleLowStockThresholdToggle(checked: boolean) {
    setHasLowStockThreshold(checked);
    if (!checked) {
      setEditingTicketType((prev) => ({
        ...prev,
        lowStockThreshold: null,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const validation = await validateTicketType(
      editingTicketType,
      event.startingDate,
      event.endingDate,
      maxAvailableLeftReal,
    );

    if (!validation.success) {
      const formattedErrors: { [key: string]: string } = {};
      Object.entries(validation.error || {}).forEach(([key, value]) => {
        if (value && 'errors' in value && Array.isArray(value.errors)) {
          formattedErrors[key] = value.errors[0];
        }
      });
      setError(formattedErrors);
      setIsSubmitting(false);
      return;
    }

    if (action === 'CREATE') {
      addTicketType(validation.data);
    } else if (action === 'EDIT' && ticketType?.id) {
      updateTicketType(ticketType.id, validation.data);
    }
    setIsSubmitting(false);

    setOpen(false);
    setError({});
  }

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    setError({});
    if (!open) {
      // Reset to initial state when closing
      setEditingTicketType(getInitialState());
      setHasScanLimit(ticketType?.scanLimit !== event.endingDate);
      setHasMaxSellDate(ticketType?.maxSellDate !== event.endingDate);
    }
  };

  const createTrigger = (
    <Button
      variant='ghost'
      disabled={isCreateDisabled}
      className='flex flex-col justify-center items-center border-2 rounded-2xl border-stroke p-16 bg-white hover:bg-accent-light/10'
    >
      <span className='text-3xl font-semibold'>{text}</span>
      <div>{icon}</div>
    </Button>
  );

  if (isCreateDisabled) {
    return (
      <div className='relative inline-flex'>
        {createTrigger}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute -top-2 -right-2 size-7 rounded-full bg-accent text-on-accent hover:bg-accent/90'
              aria-label='¿Por qué está deshabilitado?'
            >
              <CircleHelp className='size-4' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='max-w-xs text-sm'>
            Conectá tu cuenta de Mercado Pago desde Configuración para crear
            este tipo de ticket.
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div>{createTrigger}</div>
        ) : (
          <Button variant={'ghost'}>
            <Pencil />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='max-w-xl! w-full md:max-w-3xl! lg:max-w-4xl! max-md:top-4 max-md:w-[calc(100%-2rem)] max-md:max-w-[calc(100%-2rem)] max-md:max-h-[calc(100dvh-2rem)] max-md:translate-y-0 max-md:overflow-y-auto'>
        <DialogHeader className='max-md:pr-8'>
          <DialogTitle className='text-left'>
            Crear ticket de tipo {text}
          </DialogTitle>
          <DialogDescription hidden></DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className='flex flex-col gap-4 justify-center max-md:pb-4'
        >
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
            <div className='flex w-full shrink-0 flex-col gap-1 sm:w-32'>
              <Label className='pl-1 text-accent'>Imagen</Label>
              {editingTicketType.imageUrl ? (
                <div className='flex flex-col items-start gap-1'>
                  <div className='relative aspect-square w-full overflow-hidden rounded-md border border-stroke bg-muted/40'>
                    <Image
                      fill
                      src={editingTicketType.imageUrl}
                      className='object-cover'
                      sizes='128px'
                      alt='Imagen del tipo de ticket'
                    />
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='h-auto px-1 text-xs text-accent'
                    onClick={() => handleInputChange('imageUrl', null)}
                  >
                    Quitar
                  </Button>
                </div>
              ) : (
                <ImageUploader
                  error={error.imageUrl ?? null}
                  label='Subir'
                  description='JPG, PNG'
                  uploadErrorMessage='No se pudo agregar la imagen al ticket. Intentalo nuevamente.'
                  className='[&_label]:px-1 [&_label]:py-4 [&_label_p]:text-xs [&_label_p]:max-w-none [&_label_p.font-bold]:font-medium [&_label_p.font-bold]:no-underline'
                  onUploadComplete={(objectKey) => {
                    handleInputChange('imageUrl', generateS3Url(objectKey));
                  }}
                />
              )}
            </div>
            <div className='flex min-w-0 flex-1 flex-col gap-4'>
              <FormRow>
                <InputWithLabel
                  id='name'
                  name='name'
                  label='Nombre del ticket'
                  required
                  error={error.name}
                  value={editingTicketType.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
                <InputWithLabel
                  className='flex-none! [&>input]:w-6 [&>input]:self-center'
                  id='visibleInWeb'
                  name='visibleInWeb'
                  label='¿Visible en la web?'
                  type='checkbox'
                  error={error.visibleInWeb}
                  checked={editingTicketType.visibleInWeb}
                  onChange={(e) =>
                    handleInputChange('visibleInWeb', e.target.checked)
                  }
                />
              </FormRow>
              <InputWithLabel
                id='description'
                name='description'
                label='Descripción del ticket'
                error={error.description}
                required
                value={editingTicketType.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
              />
            </div>
          </div>
          <FormRow className='md:flex-row flex-col'>
            <InputWithLabel
              id='price'
              name='price'
              label='Precio del ticket ($)'
              type='number'
              min={0}
              error={error.price}
              placeholder='$'
              disabled={category === 'FREE'}
              value={editingTicketType.price ?? ''}
              onChange={(e) =>
                handleInputChange('price', Number(e.target.value))
              }
            />
            <InputWithLabel
              id='maxAvailable'
              name='maxAvailable'
              className='w-full'
              label={`Cantidad maxima de tickets (Tickets restantes: ${maxAvailableLeftReal})`}
              type='number'
              required
              error={error.maxAvailable}
              max={maxAvailableLeftReal}
              value={editingTicketType.maxAvailable}
              onChange={(e) =>
                handleInputChange('maxAvailable', Number(e.target.value))
              }
            />
          </FormRow>
          <FormRow className='md:flex-row flex-col'>
            <div className='flex w-full'>
              {hasStartingDate ? (
                <InputDateWithLabel
                  id='startingDate'
                  name='startingDate'
                  label='Inicio de escaneo de tickets'
                  error={error.startingDate}
                  selected={editingTicketType.startingDate ?? undefined}
                  dateType='datetime-local'
                  min={
                    event.startingDate
                      ? format(event.startingDate, "yyyy-MM-dd'T'HH:mm")
                      : undefined
                  }
                  max={
                    event.endingDate
                      ? format(event.endingDate, "yyyy-MM-dd'T'HH:mm")
                      : undefined
                  }
                  onChange={(date) => {
                    handleInputChange('startingDate', date);
                  }}
                  className='w-full '
                />
              ) : (
                <InputWithLabel
                  id='startingDate'
                  name='startingDate'
                  label='Inicio de escaneo de tickets'
                  type='text'
                  error={error.startingDate}
                  value={
                    editingTicketType.startingDate
                      ? `${format(
                          editingTicketType.startingDate,
                          'dd/MM/yyyy HH:mm b',
                        )} (Inicio del evento)`
                      : ''
                  }
                  className='w-full text-accent/50'
                  readOnly
                />
              )}
              <InputWithLabel
                label='¿Tiene?'
                id='startingDateEnabled'
                type='checkbox'
                className='[&>input]:w-6 items-center'
                name='startingDateEnabled'
                checked={hasStartingDate}
                onChange={(e) => {
                  handleStartingDateToggle(e.target.checked);
                }}
              />
            </div>
            <div className='flex w-full'>
              {hasScanLimit ? (
                <InputDateWithLabel
                  id='scanLimit'
                  name='scanLimit'
                  label='Finalización de escaneo de tickets'
                  error={error.scanLimit}
                  selected={editingTicketType.scanLimit ?? undefined}
                  dateType='datetime-local'
                  onChange={(date) => {
                    handleInputChange('scanLimit', date);
                  }}
                  className='w-full'
                />
              ) : (
                <InputWithLabel
                  id='scanLimit'
                  name='scanLimit'
                  label='Finalización de escaneo de tickets'
                  type='text'
                  error={error.scanLimit}
                  value={
                    editingTicketType.scanLimit
                      ? `${format(
                          editingTicketType.scanLimit,
                          'dd/MM/yyyy HH:mm b',
                        )} (Fin del evento)`
                      : ''
                  }
                  className='w-full text-accent/50'
                  readOnly
                />
              )}
              <InputWithLabel
                label='¿Tiene?'
                id='scanLimitEnabled'
                type='checkbox'
                className='[&>input]:w-6 items-center'
                name='scanLimitEnabled'
                checked={hasScanLimit}
                onChange={(e) => {
                  handleScanLimitToggle(e.target.checked);
                }}
              />
            </div>
          </FormRow>
          <FormRow className='md:flex-row flex-col'>
            <div className='flex w-full'>
              {hasMaxSellDate ? (
                <InputDateWithLabel
                  id='maxSellDate'
                  name='maxSellDate'
                  label='Finalización de venta de tickets'
                  error={error.maxSellDate}
                  selected={editingTicketType.maxSellDate ?? undefined}
                  dateType='datetime-local'
                  onChange={(date) => {
                    handleInputChange('maxSellDate', date);
                  }}
                  className='w-full'
                />
              ) : (
                <InputWithLabel
                  id='maxSellDate'
                  name='maxSellDate'
                  label='Finalización de venta de tickets'
                  type='text'
                  error={error.maxSellDate}
                  value={
                    editingTicketType.maxSellDate
                      ? `${format(
                          editingTicketType.maxSellDate,
                          'dd/MM/yyyy HH:mm b',
                        )} (Fin del evento)`
                      : ''
                  }
                  className='w-full text-accent/50'
                  readOnly
                />
              )}
              <InputWithLabel
                label='¿Tiene?'
                id='maxSellDateEnabled'
                type='checkbox'
                className='[&>input]:w-6 items-center data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                name='maxSellDateEnabled'
                checked={hasMaxSellDate}
                onChange={(e) => {
                  handleMaxSellDateToggle(e.target.checked);
                }}
              />
            </div>
            <div className='flex w-full flex-col gap-1'>
              <InputWithLabel
                label='¿Escaneo múltiple? (Permite volver a escanear un mismo ticket)'
                id='allowMultipleScans'
                type='checkbox'
                className='[&>input]:w-6 items-center'
                name='allowMultipleScans'
                checked={editingTicketType.allowMultipleScans}
                onChange={(e) => {
                  handleInputChange('allowMultipleScans', e.target.checked);
                }}
              />
            </div>
          </FormRow>
          <FormRow className='md:flex-row flex-col'>
            <InputWithLabel
              id='maxPerPurchase'
              name='maxPerPurchase'
              className='w-full'
              label='Cantidad maxima de tickets por venta'
              type='number'
              error={error.maxPerPurchase}
              value={editingTicketType.maxPerPurchase}
              onChange={(e) =>
                handleInputChange('maxPerPurchase', Number(e.target.value))
              }
            />
            <div className='flex'>
              {hasLowStockThreshold ? (
                <InputWithLabel
                  id='lowStockThreshold'
                  name='lowStockThreshold'
                  label='Cantidad de tickets para mostrar baja disponibilidad'
                  type='number'
                  min={0}
                  max={editingTicketType.maxAvailable}
                  error={error.lowStockThreshold}
                  value={editingTicketType.lowStockThreshold ?? 0}
                  className='w-full'
                  onChange={(e) => {
                    const value = e.target.value;
                    const numericValue =
                      Number(value) === 0 ? null : Number(value);
                    handleInputChange('lowStockThreshold', numericValue);
                  }}
                />
              ) : (
                <InputWithLabel
                  id='lowStockThreshold'
                  name='lowStockThreshold'
                  label='Cantidad de tickets para mostrar baja disponibilidad'
                  type='number'
                  error={error.lowStockThreshold}
                  value={
                    editingTicketType.lowStockThreshold
                      ? editingTicketType.lowStockThreshold
                      : 0
                  }
                  className='w-full text-accent/50'
                  readOnly
                />
              )}
              <InputWithLabel
                label='¿Tiene?'
                id='lowStockThresholdEnabled'
                type='checkbox'
                className='[&>input]:w-6 items-center self-end'
                name='lowStockThresholdEnabled'
                checked={hasLowStockThreshold}
                onChange={(e) => {
                  handleLowStockThresholdToggle(e.target.checked);
                }}
              />
            </div>
          </FormRow>

          <DialogFooter className='flex flex-col! gap-4'>
            <p className='text-sm text-accent'>
              {`Este ticket de tipo`}{' '}
              <b>{ticketTypesTranslation[category].text}</b>{' '}
              {`(cuesta ${Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
              })
                .format(editingTicketType.price ?? 0)
                .replace(/\$\s*/, '$')}).`}
              {editingTicketType.visibleInWeb ? (
                <>
                  {' '}
                  Solo se puede vender por la WEB hasta el día{' '}
                  <b>
                    {format(editingTicketType.maxSellDate!, 'dd/MM/yyyy p')}
                  </b>
                </>
              ) : (
                <>Solo puede venderse en PUERTA</>
              )}
              {`, y es válida para ingresar hasta el día `}
              <b>{format(editingTicketType.scanLimit!, 'dd/MM/yyyy p')}</b>
              {`. Solo se
              pueden vender `}
              <b>{editingTicketType.maxAvailable}</b>
              {` tickets de
              este tipo, y por compra solamente se pueden emitir `}
              <b>{editingTicketType.maxPerPurchase}</b>.
            </p>
            {action === 'CREATE' ? (
              <Button type='submit' className='w-full' disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className='animate-spin size-5' />
                ) : (
                  'Crear'
                )}
              </Button>
            ) : (
              <>
                {ticketType?.id && (
                  <input
                    type='hidden'
                    name='id'
                    id='id'
                    value={ticketType?.id}
                  />
                )}
                {error.id ?? <p className='text-red-500'>{error.id}</p>}
                <div className='flex flex-col md:flex-row'>
                  <DialogClose asChild>
                    <Button
                      variant='ghost'
                      className='flex-1 md:order-1 order-2'
                    >
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    type='submit'
                    className='rounded-md order-1 md:order-2 flex-1'
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className='animate-spin size-5' />
                    ) : (
                      'Editar'
                    )}
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
