'use client';

import {
  type CreateLocationActionState,
  handleCreate,
  handleUpdate,
  type UpdateLocationActionState,
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
import { type Location } from '@/server/schemas/location';
import { Pencil } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import InputWithLabel from '../common/InputWithLabel';

type LocationModalProps = {
  action: 'CREATE' | 'EDIT';
  location?: Location;
};

export default function LocationModal({
  action,
  location,
}: LocationModalProps) {
  const actionHandler = action === 'CREATE' ? handleCreate : handleUpdate;
  const toastMsg = action === 'CREATE' ? 'creado' : 'modificado';
  type ActionStateType = CreateLocationActionState | UpdateLocationActionState;

  const [state, createAction, isPending] = useActionState<
    ActionStateType,
    FormData
  >(actionHandler, location ?? {});

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la locación con éxito!`);
    }
  }, [state, toastMsg]);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div className='w-full flex justify-end'>
            <Button className='w-fit'>Crear nueva locación</Button>
          </div>
        ) : (
          <Button variant='ghost' className='absolute top-0 right-0'>
            <Pencil />
          </Button>
        )}
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
                id='name'
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
                id='address'
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
                id='capacity'
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
                id='googleMapsUrl'
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
            {action === 'EDIT' && location ? (
              <>
                <input type='hidden' name='id' value={location.id} />
                <DialogClose asChild>
                  <Button variant='ghost'>Cancelar</Button>
                </DialogClose>
                <Button
                  type='submit'
                  disabled={isPending}
                  className='rounded-md'
                >
                  Editar
                </Button>
              </>
            ) : (
              <Button
                type='submit'
                disabled={isPending}
                className='w-full rounded-md'
              >
                Crear
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
