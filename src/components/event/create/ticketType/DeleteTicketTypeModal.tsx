'use client';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useCreateEventStore } from '@/app/admin/event/create/provider';
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

export default function DeleteTicketTypeModal({ id }: { id: string }) {
  const deleteTicketType = useCreateEventStore(
    (state) => state.deleteTicketType,
  );

  const handleDelete = () => {
    deleteTicketType(id);
    setOpen(false);
  };

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={'ghost'} className='text-red-500'>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Eliminar Tipo de Entrada</DialogTitle>
        <DialogDescription>
          ¿Estas seguro de querer eliminar este tipo de entrada? Esta accion no
          puede ser deshecha.
        </DialogDescription>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant='ghost'>Cancelar</Button>
          </DialogClose>
          <Button variant={'destructive'} onClick={() => handleDelete()}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
