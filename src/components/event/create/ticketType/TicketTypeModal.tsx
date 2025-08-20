import { useCreateEventStore } from '@/app/admin/event/create/provider';
import { validateTicketType } from '@/app/admin/event/create/actions';
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
import { format } from 'date-fns';
import { Pencil } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { type EventState } from '@/app/admin/event/create/state';

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

  const { addTicketType, event, updateTicketType } = useCreateEventStore(
    useShallow((state) => ({
      addTicketType: state.addTicketType,
      updateTicketType: state.updateTicketType,
      event: state.event,
    })),
  );

  // Initialize editing state based on props
  function getInitialState(): CreateTicketTypeSchema {
    if (ticketType) {
      return {
        name: ticketType.name || '',
        description: ticketType.description || '',
        price: ticketType.price,
        maxPerPurchase: ticketType.maxPerPurchase || 6,
        maxAvailable: ticketType.maxAvailable || 0,
        maxSellDate: ticketType.maxSellDate || event.startingDate,
        scanLimit: ticketType.scanLimit || event.endingDate,
        category,
      };
    }
    return {
      name: '',
      description: '',
      price: category === 'FREE' ? 0 : null,
      maxPerPurchase: 6,
      maxAvailable: 0,
      maxSellDate: event.startingDate,
      scanLimit: event.endingDate,
      category,
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
    ticketType?.maxSellDate !== event.startingDate,
  );

  function handleInputChange(
    field: keyof CreateTicketTypeSchema,
    value: string | number | Date,
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
        maxSellDate: event.startingDate,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const rawData = {
      name: editingTicketType.name,
      description: editingTicketType.description,
      price: editingTicketType.price,
      maxPerPurchase: editingTicketType.maxPerPurchase,
      maxAvailable: editingTicketType.maxAvailable,
      maxSellDate: editingTicketType.maxSellDate,
      scanLimit: editingTicketType.scanLimit,
      category: editingTicketType.category,
    };

    const validation = await validateTicketType(
      rawData,
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
      setHasMaxSellDate(ticketType?.maxSellDate !== event.startingDate);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div>
            <Button
              variant='ghost'
              className='flex flex-col justify-center items-center border-2 rounded-2xl border-pn-accent p-16 bg-gray-100 hover:bg-pn-accent/20'
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
          <DialogTitle>Crear entrada de tipo {text}</DialogTitle>
          <DialogDescription hidden></DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className='flex flex-col gap-4 justify-center'
        >
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
            error={error.price}
            placeholder='$'
            disabled={category === 'FREE'}
            value={editingTicketType.price || ''}
            onChange={(e) => handleInputChange('price', Number(e.target.value))}
          />
          <div className='grid grid-cols-2 gap-6'>
            <div className='grid gap-4'>
              <InputWithLabel
                id='maxAvailable'
                name='maxAvailable'
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
                label='Cantidad maxima de entradas por venta'
                type='number'
                error={error.maxPerPurchase}
                value={editingTicketType.maxPerPurchase}
                onChange={(e) =>
                  handleInputChange('maxPerPurchase', Number(e.target.value))
                }
              />
            </div>
            <div className='grid gap-4'>
              <div className='flex'>
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
                    onChange={(e) =>
                      handleInputChange('scanLimit', new Date(e.target.value))
                    }
                    className='w-full'
                  />
                ) : (
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
                    className='w-full text-pn-gray'
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
              <div className='flex'>
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
                    onChange={(e) =>
                      handleInputChange('maxSellDate', new Date(e.target.value))
                    }
                    className='w-full'
                  />
                ) : (
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
                    className='w-full text-pn-gray'
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
            </div>
          </div>
          <DialogFooter>
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
                <DialogClose asChild>
                  <Button variant='ghost'>Cancelar</Button>
                </DialogClose>
                <Button type='submit' className='rounded-md'>
                  Editar
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
