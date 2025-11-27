'use client';
import { Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/server/trpc/client';

export default function ChangeEventFolder({
  eventId,
  folderId,
}: {
  eventId: string;
  folderId?: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    folderId || '',
  );

  const { data: folders } = trpc.eventFolder.getAll.useQuery();

  // Reset selected folder when dialog opens or folderId changes
  useEffect(() => {
    if (open) {
      setSelectedFolderId(folderId || '');
    }
  }, [open, folderId]);

  const changeEventFolder = trpc.eventFolder.changeFolder.useMutation({
    onSuccess: () => {
      toast.success('Carpeta cambiada correctamente');
      setOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    if (!selectedFolderId) {
      toast.error('Por favor selecciona una carpeta');
      return;
    }
    changeEventFolder.mutate({
      eventId,
      folderId: selectedFolderId,
    });
    utils.events.getAll.invalidate();
  };

  const selectedFolder = folders?.find(
    (folder) => folder.id === selectedFolderId,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={'ghost'} size={'icon'} className='text-on-accent'>
          <Folder />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar carpeta del evento</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='folder-select'>Carpeta</Label>
          {folders && folders.length > 0 ? (
            <Select
              value={selectedFolderId}
              onValueChange={setSelectedFolderId}
            >
              <SelectTrigger id='folder-select' className='w-full'>
                <SelectValue placeholder='Selecciona una carpeta'>
                  {selectedFolder ? (
                    <div className='flex items-center gap-2'>
                      <div
                        className='w-4 h-4 rounded-full border border-stroke'
                        style={{ backgroundColor: selectedFolder.color }}
                      />
                      <span>{selectedFolder.name}</span>
                    </div>
                  ) : (
                    'Selecciona una carpeta'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className='flex items-center gap-2'>
                      <div
                        className='w-4 h-4 rounded-full border border-stroke'
                        style={{ backgroundColor: folder.color }}
                      />
                      <span>{folder.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className='text-sm text-muted-foreground'>
              No hay carpetas disponibles. Crea una carpeta primero.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='ghost'>Cancelar</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={
              changeEventFolder.isPending || !folders || folders.length === 0
            }
          >
            {changeEventFolder.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
