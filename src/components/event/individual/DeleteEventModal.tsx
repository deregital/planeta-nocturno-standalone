'use client';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function DeleteEventModal({
  event,
}: {
  event: RouterOutputs['events']['getBySlug'];
}) {
  if (!event) throw new Error('Event requerido');

  const router = useRouter();
  const deleteEvent = trpc.events.delete.useMutation({
    onSuccess: () => {
      toast.success('Evento eliminado correctamente');
      router.replace('/admin/event');
    },
    onError: () => {
      toast.error('Hubo un error al eliminar el evento, intente nuevamente');
    },
  });

  const [input, setInput] = useState('');
  const [confirm, setConfirm] = useState(false);
  const disabled = useMemo(() => {
    return input !== event.name.trim();
  }, [input, event.name]);

  const handleDelete = () => {
    if (!confirm) {
      setConfirm(true);
    } else {
      deleteEvent.mutate(event.id);
      setConfirm(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={'destructive'}>
          <Trash2 />
          Eliminar evento
        </Button>
      </DialogTrigger>
      <DialogContent>
        {event.isActive ? (
          <>
            <DialogTitle className='text-lg font-bold'>
              Para eliminar el evento primero debe desactivarlo
            </DialogTitle>
            <DialogDescription>
              Por favor verifica que el evento esté desactivado, de lo
              contrario, no se podrá efectuar la eliminación.
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle className='text-lg font-bold'>
              ¿Estás seguro de querer eliminar este evento?
            </DialogTitle>
            <DialogDescription>
              Esta acción es irreversible y eliminará toda la información
              relacionada con el evento. Escriba{' '}
              <span className='font-bold'>{event.name}</span> para confirmar la
              eliminación.
            </DialogDescription>
            <Input value={input} onChange={(e) => setInput(e.target.value)} />
            <DialogFooter>
              <Button
                onClick={handleDelete}
                disabled={disabled || deleteEvent.isPending}
                variant={'destructive'}
              >
                {confirm ? '¿Estás seguro?' : 'Eliminar evento'}
              </Button>
              <DialogClose asChild>
                <Button onClick={() => setConfirm(false)} variant={'ghost'}>
                  Cancelar
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
