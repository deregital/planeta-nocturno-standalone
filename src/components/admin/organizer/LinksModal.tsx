'use client';

import { Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';

import { updateLinks } from '@/app/(backoffice)/admin/users/[id]/action';
import {
  updateOwnLinks,
  type UpdateOwnLinksState,
} from '@/app/(backoffice)/profile/actions';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/server/trpc/client';

interface LinksModalParams {
  mercadopago?: string | null;
  googleDriveUrl?: string | null;
  organizerId?: string;
  /** self: el usuario edita sus propios enlaces desde Mis datos. */
  mode?: 'organizer' | 'self';
}

export default function LinksModal({
  mercadopago,
  googleDriveUrl,
  organizerId,
  mode = 'organizer',
}: LinksModalParams) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(
    mode === 'self' ? updateOwnLinks : updateLinks,
    {} as UpdateOwnLinksState,
  );
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const hasLinks = Boolean(mercadopago || googleDriveUrl);
  const handledSave = useRef<UpdateOwnLinksState | null>(null);

  useEffect(() => {
    if (!state.success || handledSave.current === state) return;
    handledSave.current = state;

    setOpen(false);
    if (mode === 'self') {
      void utils.user.getUnsensitiveInfoById.invalidate();
      router.refresh();
      return;
    }

    void utils.organizer.getInfoById.invalidate();
  }, [state, mode, router, utils]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === 'self' ? (
          <Button variant='ghost' type='button'>
            {hasLinks ? <Pencil /> : <Plus />}
            {hasLinks ? 'Editar enlaces' : 'Agregar enlaces'}
          </Button>
        ) : hasLinks ? (
          <Button variant='ghost' size='icon' type='button'>
            <Pencil />
          </Button>
        ) : (
          <Button variant='ghost' type='button'>
            <Plus /> Agregar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='font-bold text-xl'>Enlaces</DialogTitle>
        </DialogHeader>
        <form action={action} className='flex flex-col gap-4'>
          {mode === 'organizer' && organizerId && (
            <input
              hidden
              id='organizerId'
              name='organizerId'
              value={organizerId}
              readOnly
            />
          )}
          <div className='flex flex-col gap-1'>
            <InputWithLabel
              id='mercadopago'
              name='mercadopago'
              label='Alias/CVU (opcional)'
              placeholder='alias.mp o CVU'
              defaultValue={state.data?.mercadopago ?? mercadopago ?? ''}
              error={state.errors?.mercadopago}
            />
            <p className='pl-1 text-xs text-muted-foreground'>
              {mode === 'self'
                ? 'Para que te transfieran. Se copia desde tu perfil.'
                : 'Para transferirle. Se copia desde el perfil.'}
            </p>
          </div>
          <div className='flex flex-col gap-1'>
            <InputWithLabel
              id='googleDriveUrl'
              name='googleDriveUrl'
              label='Google Drive (opcional)'
              placeholder='https://drive.google.com/...'
              defaultValue={state.data?.googleDriveUrl ?? googleDriveUrl ?? ''}
              error={state.errors?.googleDriveUrl}
            />
            <p className='pl-1 text-xs text-muted-foreground'>
              {mode === 'self'
                ? 'Tu carpeta de trabajo. Aparece en la barra de arriba.'
                : 'Su carpeta de trabajo. Aparece en su barra de arriba.'}
            </p>
          </div>
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
