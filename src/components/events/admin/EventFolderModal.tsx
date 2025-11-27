'use client';
import Color from 'color';
import { Pencil, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerSelection,
} from '@/components/ui/shadcn-io/color-picker';
import { randomColor } from '@/lib/utils-client';
import { type EventFolder } from '@/server/schemas/event-folder';
import { trpc } from '@/server/trpc/client';

interface EventFolderModalProps {
  action: 'CREATE' | 'EDIT';
  folder?: EventFolder;
}

export default function EventFolderModal({
  action,
  folder,
}: EventFolderModalProps) {
  const [open, setOpen] = useState(false);
  const randomColorValue = useMemo(() => randomColor(), []);
  const [folderState, setFolderState] = useState<EventFolder>(() => {
    if (folder) {
      return {
        id: folder.id,
        name: folder.name || '',
        color: folder.color || randomColor(),
      };
    }
    return {
      id: '',
      name: '',
      color: randomColor(),
    };
  });

  const createFolder = trpc.eventFolder.create.useMutation({
    onError: (error) => {
      toast.error(
        JSON.parse(error.message)[0].message ||
          'Error al crear la carpeta de eventos',
      );
    },
    onSuccess: () => {
      toast.success('Carpeta creada correctamente');
      setOpen(false);
    },
  });
  const updateFolder = trpc.eventFolder.update.useMutation({
    onError: (error) => {
      toast.error(
        JSON.parse(error.message)[0].message ||
          'Error al editar la carpeta de eventos',
      );
    },
    onSuccess: () => {
      toast.success('Carpeta editada correctamente');
      setOpen(false);
    },
  });
  const deleteFolder = trpc.eventFolder.delete.useMutation({
    onError: (error) => {
      toast.error(
        JSON.parse(error.message)[0].message ||
          'Error al eliminar la carpeta de eventos',
      );
    },
  });

  // Reset state when dialog opens or folder changes
  useEffect(() => {
    if (open) {
      if (folder) {
        setFolderState({
          id: folder.id,
          name: folder.name || '',
          color: folder.color || randomColorValue,
        });
      } else {
        setFolderState({
          id: '',
          name: '',
          color: randomColorValue,
        });
      }
    }
  }, [open, folder, randomColorValue]);

  const handleColorChange = useCallback((rgba: unknown) => {
    if (Array.isArray(rgba) && rgba.length >= 3) {
      const hex = Color.rgb(rgba[0], rgba[1], rgba[2]).hex();
      setFolderState((prev) => ({ ...prev, color: hex }));
    }
  }, []);

  async function handleSubmit() {
    console.log(folderState);
    if (action === 'CREATE') {
      createFolder.mutate({ name: folderState.name, color: folderState.color });
    } else if (action === 'EDIT') {
      if (!folder) {
        toast.error('No se encontró la carpeta');
        return;
      }
      updateFolder.mutate({
        id: folder?.id,
        name: folderState.name,
        color: folderState.color,
      });
    }
  }
  async function handleDelete() {
    if (!folder) {
      toast.error('No se encontró la carpeta');
      return;
    }
    deleteFolder.mutate(folder.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {action === 'CREATE' ? (
          <Button>
            <Plus /> Crear carpeta
          </Button>
        ) : (
          <Button variant='ghost' className='text-white'>
            <Pencil />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear carpeta</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <InputWithLabel
            label='Nombre de la carpeta'
            id='name'
            name='name'
            placeholder='Mi carpeta'
            value={folderState.name}
            onChange={(e) =>
              setFolderState({ ...folderState, name: e.target.value })
            }
          />
          <div className='flex flex-col gap-2'>
            <Label htmlFor='color-picker' className='text-accent'>
              Color de la carpeta
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  id='color-picker'
                  type='button'
                  className='w-full h-10 cursor-pointer rounded transition-opacity hover:opacity-80'
                  style={{
                    backgroundColor: folderState.color || randomColorValue,
                  }}
                />
              </PopoverTrigger>
              <PopoverContent className='w-auto p-3' align='start'>
                <ColorPicker
                  value={folderState.color || randomColorValue}
                  onChange={handleColorChange}
                >
                  <div className='h-48 w-64'>
                    <ColorPickerSelection />
                  </div>
                  <ColorPickerHue />
                </ColorPicker>
              </PopoverContent>
            </Popover>
          </div>
          <input hidden name='id' value={folder?.id} readOnly />
        </div>
        <DialogFooter>
          {action === 'CREATE' ? (
            <Button onClick={handleSubmit}>Crear</Button>
          ) : (
            <>
              <Button onClick={handleDelete} variant='destructive'>
                Eliminar
              </Button>
              <Button onClick={handleSubmit}>Editar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
