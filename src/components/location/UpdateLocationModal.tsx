'use client';

import {
  handleUpdate,
  UpdateLocationActionState,
} from '@/app/admin/locations/action';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Location } from '@/server/schemas/location';
import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import InputWithLabel from '../common/InputWithLabel';

export default function UpdateLocationModal({
  location,
}: {
  location: Location;
}) {
  const [state, createAction, isPending] = useActionState<
    UpdateLocationActionState,
    FormData
  >(handleUpdate, location);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast('¡Se ha modificado la locación con éxito!');
    }
  }, [state]);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' className='absolute top-0 right-0'>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={createAction}>
          <DialogHeader>
            <DialogTitle>
              <p className='font-bold text-xl'>Editar locación</p>
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
            <input type='hidden' name='id' value={location.id} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='ghost'>Cancelar</Button>
            </DialogClose>
            <Button type='submit' disabled={isPending} className='rounded-md'>
              Editar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
