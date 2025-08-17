import { useCreateEventStore } from '@/app/admin/event/create/provider';
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

import {
  type CreateTicketTypeSchema,
  createTicketTypeSchema,
} from '@/server/schemas/ticket-type';
import { type TicketTypeCategory } from '@/server/types';
import { Pencil } from 'lucide-react';
import React, { useState } from 'react';
import z from 'zod';
import { useShallow } from 'zustand/react/shallow';

type TicketTypeModalProps = {
  category: TicketTypeCategory;
  maxAvailableLeft: number;
  action: 'CREATE' | 'EDIT';
  ticketType?: CreateTicketTypeSchema & { id: string };
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

  const { addTicketType, event, updateTicketType } = useCreateEventStore(
    useShallow((state) => ({
      addTicketType: state.addTicketType,
      updateTicketType: state.updateTicketType,
      event: state.event,
    })),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ticketTypeId = formData.get('id')?.toString() || '';

    const rawData = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: Number(formData.get('price') ?? null),
      maxPerPurchase: Number(formData.get('maxPerPurchase')),
      maxAvailable: Number(formData.get('maxAvailable')),
      maxSellDate: formData.get('maxSellDate'),
      scanLimit: formData.get('scanLimit'),
      category,
    };

    const validation = createTicketTypeSchema.safeParse(rawData);

    if (!validation.success) {
      const keyAndError = Object.entries(
        z.treeifyError(validation.error).properties ?? {},
      );
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
      addTicketType(validation.data);
    } else if (action === 'EDIT') {
      console.log(ticketTypeId);
      if (!z.uuid().safeParse(ticketTypeId).success) {
        setError({
          id: 'El id del tipo no es válido. Intente nuevamente.',
        });
        return;
      }

      updateTicketType(ticketTypeId, validation.data);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div>
            <Button
              variant='ghost'
              className='flex flex-col justify-center items-center border-2 rounded-2xl border-pn-accent p-16 bg-gray-100 hover:bg-pn-accent/20'
            >
              <span className='text-3xl font-semibold'>{text}</span>
              <div className=''>{icon}</div>
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
          <DialogTitle>Crear entrada - {text}</DialogTitle>
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
            defaultValue={ticketType?.name}
          />
          <InputWithLabel
            id='description'
            name='description'
            label='Descripción de la entrada'
            error={error.description}
            required
            defaultValue={ticketType?.description}
          />
          <InputWithLabel
            id='price'
            name='price'
            label='Precio de la entrada'
            type='number'
            error={error.price}
            defaultValue={
              ticketType
                ? ticketType.price?.toString()
                : (category === 'FREE' && '0') || undefined
            }
          />
          <div className='grid grid-cols-2 gap-6'>
            <div className='grid gap-4'>
              <InputWithLabel
                id='maxAvailable'
                name='maxAvailable'
                label={`Cantidad maxima de entrada (Entradas restantes: ${maxAvailableLeft})`}
                type='number'
                error={error.maxAvailable}
                max={maxAvailableLeft}
                defaultValue={ticketType?.maxAvailable}
              />
              <InputWithLabel
                id='maxPerPurchase'
                name='maxPerPurchase'
                label='Cantidad maxima de entradas por venta'
                type='number'
                error={error.maxPerPurchase}
                defaultValue={ticketType?.maxPerPurchase || 6}
              />
            </div>
            <div className='grid gap-4'>
              <InputWithLabel
                id='scanLimit'
                name='scanLimit'
                label='Finalización de escaneo de entradas'
                type='datetime-local'
                error={error.scanLimit}
                defaultValue={
                  ticketType?.scanLimit?.toISOString().slice(0, 16) ||
                  event.endingDate.toISOString().slice(0, 16)
                }
              />
              <InputWithLabel
                id='maxSellDate'
                name='maxSellDate'
                label='Finalización de venta de entradas'
                type='datetime-local'
                error={error.maxSellDate}
                defaultValue={
                  ticketType?.maxSellDate?.toISOString().slice(0, 16) ||
                  event.endingDate.toISOString().slice(0, 16)
                }
              />
            </div>
          </div>
          <DialogFooter>
            {action === 'CREATE' ? (
              <Button type='submit' className='w-full'>
                Crear
              </Button>
            ) : (
              <>
                <input type='hidden' name='id' id='id' value={ticketType?.id} />
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
