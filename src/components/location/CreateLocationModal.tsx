'use client';

import {
  type CreateLocationActionState,
  handleCreate,
} from '@/app/admin/locations/action';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import InputWithLabel from '../common/InputWithLabel';

export default function CreateLocationModal() {
  const [state, createAction, isPending] = useActionState<
    CreateLocationActionState,
    FormData
  >(handleCreate, {});

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast('¡Se ha creado la locación con éxito!');
    }
  }, [state]);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className='w-full flex justify-end'>
          <Button className='w-fit'>Crear nueva locación</Button>
        </div>
      </DialogTrigger>
      <DialogContent>
        <form action={createAction}>
          <DialogHeader>
            <DialogTitle>
              <p className='font-bold text-xl'>Crear locación</p>
            </DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-6 pt-4 pb-8'>
            <div>
              <InputWithLabel
                name='name'
                label='Nombre de la locación'
                placeholder='Mi locación'
                defaultValue={state.name}
              />
              <p className='text-red-500 text-sm font-bold'>
                {state.errors?.name?.join(', ')}
              </p>
            </div>
            <div>
              <InputWithLabel
                name='address'
                label='Ubicación'
                placeholder='Balcarce 50'
                defaultValue={state.address}
              />
              <p className='text-red-500 text-sm font-bold'>
                {state.errors?.address?.join(', ')}
              </p>
            </div>
            <div>
              <InputWithLabel
                name='capacity'
                type='number'
                label='Capacidad'
                placeholder='Ingresar capacidad'
                defaultValue={state.capacity}
              />
              <p className='text-red-500 text-sm font-bold'>
                {state.errors?.capacity?.join(', ')}
              </p>
            </div>
            <div>
              <InputWithLabel
                name='googleMapsUrl'
                label='Link a Google Maps'
                placeholder='Ingresá el link'
                defaultValue={state.googleMapsUrl}
              />
              <p className='text-red-500 text-sm font-bold'>
                {state.errors?.googleMapsUrl?.join(', ')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type='submit'
              disabled={isPending}
              className='w-full rounded-md'
            >
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
