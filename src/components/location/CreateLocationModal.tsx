'use client';

import {
  CreateLocationActionState,
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
import { useActionState } from 'react';
import InputWithLabel from '../common/InputWithLabel';

export default function CreateLocationModal() {
  const [state, createAction, isPending] = useActionState<
    CreateLocationActionState,
    FormData
  >(handleCreate, {});

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Crear nueva locación</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={createAction}>
          <DialogHeader>
            <DialogTitle>Crear locación</DialogTitle>
          </DialogHeader>
          <div className='grid grid-cols-2 gap-6 py-8'>
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
            <Button type='submit' disabled={isPending} className='w-full'>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
