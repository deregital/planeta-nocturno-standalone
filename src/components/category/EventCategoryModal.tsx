'use client';

import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import InputWithLabel from '@/components/common/InputWithLabel';
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
import { type EventCategory } from '@/server/schemas/event-category';
import { trpc } from '@/server/trpc/client';

type EventCategoryModalProps = {
  action: 'CREATE' | 'EDIT';
  category?: EventCategory;
  onSuccess?: () => void;
  openController?: (open: boolean) => void;
  open?: boolean;
};

export default function EventCategoryModal({
  action,
  category,
  onSuccess,
  openController,
  open: controlledOpen,
}: EventCategoryModalProps) {
  const router = useRouter();
  const createMutation = trpc.eventCategory.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
      router.refresh();
      onSuccess?.();
    },
  });
  const editMutation = trpc.eventCategory.edit.useMutation({
    onSuccess: () => {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
      router.refresh();
      onSuccess?.();
    },
  });
  const [name, setName] = useState(category?.name || '');
  const toastMsg = action === 'CREATE' ? 'creado' : 'modificado';

  const [internalOpen, internalSetOpen] = useState(false);

  const open = controlledOpen || internalOpen;
  const setOpen = openController || internalSetOpen;

  useEffect(() => {
    if (createMutation.isSuccess) {
      setOpen(false);
      toast(`¡Se ha ${toastMsg} la categoría con éxito!`);
    }
  }, [createMutation.isSuccess, toastMsg, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <div className='w-full flex justify-end'>
            <Button className='w-fit my-4'>Crear nueva categoría</Button>
          </div>
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
            {(
              createMutation.error?.data?.zodError as { _errors?: string[] }
            )?._errors?.join(', ') || createMutation.error?.message}
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
