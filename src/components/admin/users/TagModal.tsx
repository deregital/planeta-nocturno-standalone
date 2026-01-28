'use client';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import InputWithLabel from '@/components/common/InputWithLabel';
import { Badge } from '@/components/ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { tagSchema } from '@/server/schemas/tag';
import { trpc } from '@/server/trpc/client';
import { type Tag } from '@/server/types';

interface TagModalProps {
  type: 'CREATE' | 'EDIT';
  tag?: Tag;
  userId?: string;
}

export function TagModal({ type, tag, userId }: TagModalProps) {
  const [open, setOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>('');
  const [sure, setSure] = useState(false);
  const [sureDelete, setSureDelete] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();

  // Reset form when modal opens/closes or tag changes
  useEffect(() => {
    if (open) {
      if (type === 'EDIT' && tag) {
        setName(tag.name);
      } else {
        setName('');
      }
      setError('');
      setSure(false);
      setSureDelete(false);
    }
  }, [open, type, tag]);

  const createTag = trpc.tag.create.useMutation({
    onSuccess: () => {
      toast.success('Grupo creado exitosamente');
      setOpen(false);
      utils.tag.getAll.invalidate();
      utils.user.getByRole.invalidate('ORGANIZER');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al crear el grupo');
      setError(error.message || 'Error al crear el grupo');
    },
  });

  const updateTag = trpc.tag.update.useMutation({
    onSuccess: () => {
      toast.success('Grupo actualizado exitosamente');
      setOpen(false);
      utils.tag.getAll.invalidate();
      utils.user.getByRole.invalidate('ORGANIZER');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al actualizar el grupo');
      setError(error.message || 'Error al actualizar el grupo');
    },
  });

  const removeUserFromTag = trpc.tag.removeUserFromTag.useMutation({
    onSuccess: () => {
      toast.success('Usuario removido del grupo exitosamente');
      setOpen(false);
      setPopoverOpen(false);
      setSure(false);
      utils.tag.getAll.invalidate();
      utils.user.getByRole.invalidate('ORGANIZER');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al remover el grupo');
      setSure(false);
    },
  });

  const deleteTag = trpc.tag.delete.useMutation({
    onSuccess: () => {
      toast.success('Grupo eliminado exitosamente');
      setOpen(false);
      setPopoverOpen(false);
      setSureDelete(false);
      utils.tag.getAll.invalidate();
      utils.user.getByRole.invalidate('ORGANIZER');
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar el grupo');
      setSureDelete(false);
    },
  });

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError('');

    // Validate name
    const validation = tagSchema.shape.name.safeParse(name);
    if (!validation.success) {
      const errorMessage = validation.error.message;
      setError(errorMessage || 'El nombre del grupo es requerido');
      toast.error(errorMessage || 'El nombre del grupo es requerido');
      return;
    }

    const trimmedName = name.trim();

    if (type === 'CREATE') {
      createTag.mutate(trimmedName);
    } else if (type === 'EDIT' && tag) {
      updateTag.mutate({ id: tag.id, name: trimmedName });
    }
  }

  function handleRemove() {
    if (!tag || !userId) return;
    if (sure) {
      setPopoverOpen(false);
      setSure(false);
      removeUserFromTag.mutate({ userId, tagId: tag.id });
    } else {
      setSure(true);
    }
  }

  function handleEdit() {
    setPopoverOpen(false);
    setOpen(true);
  }

  function handleDelete() {
    if (!tag) return;
    if (sureDelete) {
      setOpen(false);
      deleteTag.mutate(tag.id);
    } else {
      setSureDelete(true);
    }
  }

  if (type === 'CREATE') {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant='outline' onClick={(e) => e.stopPropagation()}>
            <Plus /> Crear grupo
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo grupo</DialogTitle>
            <DialogDescription>
              Crea un nuevo grupo para organizar usuarios
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='mb-4'>
              <InputWithLabel
                id='name'
                name='name'
                label='Nombre del grupo'
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                error={error}
                required
                maxLength={20}
                disabled={
                  createTag.isPending ||
                  updateTag.isPending ||
                  removeUserFromTag.isPending ||
                  deleteTag.isPending
                }
              />
            </div>
            <DialogFooter>
              <Button
                type='submit'
                disabled={
                  createTag.isPending ||
                  updateTag.isPending ||
                  removeUserFromTag.isPending ||
                  deleteTag.isPending ||
                  !name.trim()
                }
              >
                {createTag.isPending ? 'Guardando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <DropdownMenu
        open={popoverOpen}
        onOpenChange={(open) => {
          if (!open && sure) {
            return;
          }
          setPopoverOpen(open);
          if (!open) {
            setSure(false);
          }
        }}
      >
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Badge
            variant='outline'
            className='cursor-pointer hover:brightness-110 bg-gray-50'
          >
            {tag?.name}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <DropdownMenuItem
            className='focus:cursor-pointer'
            onClick={handleEdit}
          >
            Editar
          </DropdownMenuItem>
          {userId && (
            <DropdownMenuItem
              variant='destructive'
              onSelect={(e) => {
                if (!sure) {
                  e.preventDefault();
                }
                handleRemove();
              }}
              disabled={removeUserFromTag.isPending}
              className='text-red-500 focus:cursor-pointer'
            >
              {removeUserFromTag.isPending
                ? 'Removiendo...'
                : sure
                  ? '¿Estás seguro?'
                  : 'Remover'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
            <DialogDescription>Modifica el nombre del grupo</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className='mb-4'>
              <InputWithLabel
                id='name'
                name='name'
                label='Nombre del grupo'
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                error={error}
                required
                maxLength={20}
                disabled={
                  createTag.isPending ||
                  updateTag.isPending ||
                  removeUserFromTag.isPending ||
                  deleteTag.isPending
                }
              />
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='destructive'
                onClick={handleDelete}
                disabled={
                  createTag.isPending ||
                  updateTag.isPending ||
                  removeUserFromTag.isPending ||
                  deleteTag.isPending
                }
              >
                {deleteTag.isPending
                  ? 'Eliminando...'
                  : sureDelete
                    ? '¿Estás seguro?'
                    : 'Eliminar grupo'}
              </Button>
              <Button
                type='submit'
                disabled={
                  createTag.isPending ||
                  updateTag.isPending ||
                  removeUserFromTag.isPending ||
                  deleteTag.isPending ||
                  !name.trim()
                }
              >
                {updateTag.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
