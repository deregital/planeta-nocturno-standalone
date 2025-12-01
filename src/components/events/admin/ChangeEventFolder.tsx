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
    folderId || 'none',
  );

  const { data: folders } = trpc.eventFolder.getAll.useQuery();

  // Reset selected folder when dialog opens or folderId changes
  useEffect(() => {
    if (open) {
      setSelectedFolderId(folderId || 'none');
    }
  }, [open, folderId]);

  const changeEventFolder = trpc.eventFolder.changeFolder.useMutation({
    onSuccess: () => {
      toast.success('Carpeta cambiada correctamente');
      setOpen(false);
      utils.events.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    changeEventFolder.mutate({
      eventId,
      folderId:
        selectedFolderId === 'none' || selectedFolderId === ''
          ? null
          : selectedFolderId,
    });
  };

  const selectedFolder = folders?.find(
    (folder) => folder.id === selectedFolderId,
  );
  const hasNoFolder = selectedFolderId === 'none' || selectedFolderId === '';

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
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger id='folder-select' className='w-full'>
              <SelectValue placeholder='Selecciona una carpeta'>
                {hasNoFolder ? (
                  'Sin Carpeta'
                ) : selectedFolder ? (
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
              <SelectItem value='none'>
                <span>Sin Carpeta</span>
              </SelectItem>
              {folders?.map((folder) => (
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
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='ghost'>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={changeEventFolder.isPending}>
            {changeEventFolder.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
