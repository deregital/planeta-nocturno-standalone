'use client';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { revalidateLocations } from '@/app/admin/locations/action';
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
import { trpc } from '@/server/trpc/client';

export default function DeleteLocationModal({ id }: { id: string }) {
  const deleteLocation = trpc.location.delete.useMutation({
    onSuccess: () => {
      toast('¡Locación eliminada con éxito!');
      revalidateLocations();
      setOpen(false);
    },
  });

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='destructive' className='absolute bottom-4 right-0'>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Eliminar Locación</DialogTitle>
        <DialogDescription>
          ¿Estas seguro de querer eliminar esta locación? Esta accion no puede
          ser deshecha.
        </DialogDescription>
        {deleteLocation.isError && (
          <p className='text-sm text-red-600'>
            Error al eliminar la locación. Recuerde que debe eliminar o
            modificar los eventos asociados a esta locación.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='ghost'>Cancelar</Button>
          </DialogClose>
          <Button
            variant='destructive'
            onClick={() => deleteLocation.mutate(id)}
            disabled={deleteLocation.isPending}
          >
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
