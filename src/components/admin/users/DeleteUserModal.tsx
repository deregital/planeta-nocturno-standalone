'use client';

import { Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/server/trpc/client';
import { type User } from '@/server/types';

export function DeleteUserModal({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast.success('Usuario eliminado correctamente');
      router.refresh();
      setOpen(false);
    },
    onError: () => {
      toast.error('Error al eliminar el usuario');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='icon' className='rounded-md' variant={'ghost'}>
          <Trash className='text-red-500 size-4' />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Eliminar Usuario {user.name}</DialogTitle>
        <DialogDescription>
          ¿Estás seguro de querer eliminar el usuario {user.name}? Esta acción
          es irreversible.
        </DialogDescription>
        <DialogFooter>
          <Button
            variant={'destructive'}
            onClick={() => deleteUser.mutate(user.id)}
            disabled={deleteUser.isPending}
          >
            Eliminar
          </Button>
          <Button onClick={() => setOpen(false)} variant={'ghost'}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
