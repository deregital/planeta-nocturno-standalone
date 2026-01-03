'use client';

import { Pencil, Plus } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import { updateLinks } from '@/app/(backoffice)/admin/users/[id]/action';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/server/trpc/client';

interface LinksModalParams {
  mercadopago?: string | null;
  googleDriveUrl?: string | null;
  organizerId: string;
}

export default function LinksModal({
  mercadopago,
  googleDriveUrl,
  organizerId,
}: LinksModalParams) {
  const [state, action, isPending] = useActionState(updateLinks, {});
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      utils.organizer.getInfoById.invalidate();
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mercadopago && googleDriveUrl ? (
          <Button variant='ghost' size='icon'>
            <Pencil />
          </Button>
        ) : (
          <Button variant='ghost'>
            <Plus /> Agregar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <p className='font-bold text-xl'>Enlaces</p>
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <form action={action} className='flex flex-col gap-4'>
          <input
            hidden
            id='organizerId'
            name='organizerId'
            value={organizerId}
            readOnly
          />
          <InputWithLabel
            id='mercadopago'
            name='mercadopago'
            label='Alias/CVU (opcional)'
            defaultValue={state.data?.mercadopago ?? mercadopago ?? ''}
            error={state.errors?.mercadopago}
          />
          <InputWithLabel
            id='googleDriveUrl'
            name='googleDriveUrl'
            label='Google Drive (opcional)'
            defaultValue={state.data?.googleDriveUrl ?? googleDriveUrl ?? ''}
            error={state.errors?.googleDriveUrl}
          />
          <DialogFooter>
            <DialogTrigger asChild>
              <Button variant='ghost' type='button'>
                Cancelar
              </Button>
            </DialogTrigger>
            <Button type='submit' disabled={isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
