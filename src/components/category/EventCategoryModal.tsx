'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { type EventCategory } from '@/server/schemas/event-category';
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
import { Button } from '@/components/ui/button';
import InputWithLabel from '@/components/common/InputWithLabel';
import { trpc } from '@/server/trpc/client';

type EventCategoryModalProps = {
  action: 'CREATE' | 'EDIT';
  category?: EventCategory;
};

export default function EventCategoryModal({
  action,
  category,
}: EventCategoryModalProps) {
  const router = useRouter();
  const createMutation = trpc.eventCategory.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
      router.refresh();
    },
  });
  const editMutation = trpc.eventCategory.edit.useMutation({
    onSuccess: () => {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
      router.refresh();
    },
  });
  const [name, setName] = useState(category?.name || '');
  const toastMsg = action === 'CREATE' ? 'creado' : 'modificado';

  useEffect(() => {
    if (createMutation.isSuccess) {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
    }
  }, [createMutation.isSuccess, toastMsg]);

  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <Button className='w-fit my-4'>Crear nueva categoría</Button>
        ) : (
          <Button variant='ghost' className='text-inherit'>
            <Pencil />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <p className='font-bold text-xl'>Crear categoría</p>
          </DialogTitle>
        </DialogHeader>
        <DialogDescription hidden></DialogDescription>
        <div>
          <InputWithLabel
            id='name'
            name='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            label='Nombre de la categoría'
            placeholder='Mi categoría'
          />
          <p className='text-red-500 text-sm font-bold'>
            {createMutation.error?.data?.zodError?.errors?.join(', ')}
          </p>
        </div>
        <DialogFooter>
          {action === 'EDIT' && category ? (
            <>
              <DialogClose asChild>
                <Button variant='ghost'>Cancelar</Button>
              </DialogClose>
              <Button
                onClick={() => editMutation.mutate({ id: category.id, name })}
                type='submit'
                disabled={editMutation.isPending}
                className='rounded-md'
              >
                Editar
              </Button>
            </>
          ) : (
            <Button
              onClick={() => createMutation.mutate({ name })}
              disabled={createMutation.isPending}
              className='w-full rounded-md'
            >
              Crear
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
