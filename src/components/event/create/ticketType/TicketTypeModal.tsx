import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { validateTicketType } from '@/app/(backoffice)/admin/event/create/actions';
import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import { type EventState } from '@/app/(backoffice)/admin/event/create/state';
import { FormRow } from '@/components/common/FormRow';
import InputWithLabel from '@/components/common/InputWithLabel';
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
import { ticketTypesTranslation } from '@/lib/translations';
import { type CreateTicketTypeSchema } from '@/server/schemas/ticket-type';
import { type TicketTypeCategory } from '@/server/types';

type TicketTypeModalProps = {
  category: TicketTypeCategory;
  maxAvailableLeft: number;
  action: 'CREATE' | 'EDIT';
  ticketType?: EventState['ticketTypes'][number];
};

export default function TicketTypeModal({
  category,
  maxAvailableLeft,
  action,
  ticketType,
}: TicketTypeModalProps) {
  const { text, icon } = ticketTypesTranslation[category];
  const [error, setError] = useState<{
    [key: string]: string;
  }>({});

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
        category,
        id: ticketType.id,
        visibleInWeb: ticketType.visibleInWeb,
        lowStockThreshold: ticketType.lowStockThreshold,
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
      category,
      id: crypto.randomUUID(),
      visibleInWeb: true,
      lowStockThreshold: null,
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
      return;
    }

    if (action === 'CREATE') {
      addTicketType(validation.data);
    } else if (action === 'EDIT' && ticketType?.id) {
      updateTicketType(ticketType.id, validation.data);
    }

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div>
            <Button
              variant='ghost'
              className='flex flex-col justify-center items-center border-2 rounded-2xl border-stroke p-16 bg-white hover:bg-accent-light/10'
            >
              <span className='text-3xl font-semibold'>{text}</span>
              <div>{icon}</div>
            </Button>
          </div>
        ) : (
          <Button variant={'ghost'}>
            <Pencil />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='!max-w-xl md:!max-w-3xl w-full lg:!max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='text-left'>
            Crear entrada de tipo {text}
          </DialogTitle>
          <DialogDescription hidden></DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className='flex flex-col gap-4 justify-center'
        >
          <FormRow>
            <InputWithLabel
              id='name'
              name='name'
              label='Nombre de la entrada'
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
            label='Descripción de la entrada'
            error={error.description}
            required
            value={editingTicketType.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
          />
          <InputWithLabel
            id='price'
            name='price'
            label='Precio de la entrada ($)'
            type='number'
            min={0}
            error={error.price}
            placeholder='$'
            disabled={category === 'FREE'}
            value={editingTicketType.price ?? ''}
            onChange={(e) => handleInputChange('price', Number(e.target.value))}
          />
          <FormRow className='md:flex-row flex-col'>
            <InputWithLabel
              id='maxAvailable'
              name='maxAvailable'
              className='w-full'
              label={`Cantidad maxima de entrada (Entradas restantes: ${maxAvailableLeftReal})`}
              type='number'
              required
              error={error.maxAvailable}
              max={maxAvailableLeftReal}
              value={editingTicketType.maxAvailable}
              onChange={(e) =>
                handleInputChange('maxAvailable', Number(e.target.value))
              }
            />
            <InputWithLabel
              id='maxPerPurchase'
              name='maxPerPurchase'
              className='w-full'
              label='Cantidad maxima de entradas por venta'
              type='number'
              error={error.maxPerPurchase}
              value={editingTicketType.maxPerPurchase}
              onChange={(e) =>
                handleInputChange('maxPerPurchase', Number(e.target.value))
              }
            />
          </FormRow>
          <FormRow className='md:flex-row flex-col'>
            <div className='flex w-full'>
              {hasScanLimit ? (
                <InputWithLabel
                  id='scanLimit'
                  name='scanLimit'
                  label='Finalización de escaneo de entradas'
                  type='datetime-local'
                  error={error.scanLimit}
                  value={
                    editingTicketType.scanLimit
                      ? format(
                          editingTicketType.scanLimit,
                          "yyyy-MM-dd'T'HH:mm",
                        )
                      : ''
                  }
                  onChange={(e) => {
                    if (!e.target.value) {
                      return;
                    }
                    handleInputChange('scanLimit', new Date(e.target.value));
                  }}
                  className='w-full'
                />
              ) : (
                <InputWithLabel
                  id='scanLimit'
                  name='scanLimit'
                  label='Finalización de escaneo de entradas'
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
            <div className='flex w-full'>
              {hasMaxSellDate ? (
                <InputWithLabel
                  id='maxSellDate'
                  name='maxSellDate'
                  label='Finalización de venta de entradas'
                  type='datetime-local'
                  error={error.maxSellDate}
                  value={
                    editingTicketType.maxSellDate
                      ? format(
                          editingTicketType.maxSellDate,
                          "yyyy-MM-dd'T'HH:mm",
                        )
                      : ''
                  }
                  onChange={(e) => {
                    if (!e.target.value) {
                      return;
                    }
                    handleInputChange('maxSellDate', new Date(e.target.value));
                  }}
                  className='w-full'
                />
              ) : (
                <InputWithLabel
                  id='maxSellDate'
                  name='maxSellDate'
                  label='Finalización de venta de entradas'
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
          </FormRow>
          <div className='flex'>
            {hasLowStockThreshold ? (
              <InputWithLabel
                id='lowStockThreshold'
                name='lowStockThreshold'
                label='Cantidad de entradas para mostrar baja disponibilidad'
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
                label='Cantidad de entradas para mostrar baja disponibilidad'
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
              className='[&>input]:w-6 items-center'
              name='lowStockThresholdEnabled'
              checked={hasLowStockThreshold}
              onChange={(e) => {
                handleLowStockThresholdToggle(e.target.checked);
              }}
            />
          </div>
          <DialogFooter className='flex !flex-col gap-4'>
            <p className='text-sm text-accent'>
              {`Esta entrada de tipo`}{' '}
              <b>{ticketTypesTranslation[category].text}</b>{' '}
              {`(cuesta $${editingTicketType.price ?? '-'}).`}
              {editingTicketType.visibleInWeb ? (
                <>
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
              {` entradas de
              este tipo, y por compra solamente se pueden emitir `}
              <b>{editingTicketType.maxPerPurchase}</b>.
            </p>
            {action === 'CREATE' ? (
              <Button type='submit' className='w-full'>
                Crear
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
                  >
                    Editar
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
