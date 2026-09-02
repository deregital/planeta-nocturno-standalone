'use client';

import { MessageSquareText, Pencil } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';

import { updateTenantComments } from '@/app/control/(protected)/tenants/actions';
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
import { Textarea } from '@/components/ui/textarea';

export default function EditableCommentsCell({
  tenantId,
  tenantName,
  comments,
}: {
  tenantId: number;
  tenantName: string;
  comments: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateTenantComments, {});

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  const summary = comments?.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type='button'
          className='group flex max-w-56 items-center gap-1.5 text-left cursor-pointer'
          aria-label={`Editar comentarios de ${tenantName}`}
        >
          <MessageSquareText className='size-4 shrink-0 text-gray-400' />
          <span
            className={
              summary
                ? 'truncate text-sm text-gray-700'
                : 'text-sm text-gray-400'
            }
          >
            {summary || 'Sin comentarios'}
          </span>
          <Pencil className='size-3.5 shrink-0 text-gray-400 group-hover:text-accent' />
        </button>
      </DialogTrigger>

      <DialogContent>
        <form action={action} className='grid gap-4'>
          <input type='hidden' name='tenantId' value={tenantId} />
          <DialogHeader>
            <DialogTitle>Comentarios</DialogTitle>
            <DialogDescription>
              Notas internas sobre {tenantName}.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            name='comments'
            defaultValue={comments ?? ''}
            placeholder='Escribí un comentario'
            className='min-h-40'
            aria-invalid={Boolean(state.error)}
            autoFocus
          />
          {state.error && (
            <p className='text-sm font-medium text-red-600'>{state.error}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='ghost'>
                Cancelar
              </Button>
            </DialogClose>
            <Button type='submit' disabled={pending}>
              {pending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
