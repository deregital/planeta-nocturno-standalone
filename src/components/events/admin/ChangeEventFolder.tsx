'use client';
import { Folder } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { trpc } from '@/server/trpc/client';

export default function ChangeEventFolder({
  eventId,
  folderId,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
}: {
  eventId: string;
  folderId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;
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
      router.refresh();
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
      {!hideTrigger && (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant={'ghost'}
                size={'icon'}
                className='text-on-accent'
              >
                <Folder />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Cambiar carpeta</TooltipContent>
        </Tooltip>
      )}
      <DialogContent>
        <DialogHeader className='text-left'>
          <DialogTitle className='pr-8 leading-snug'>
            Cambiar carpeta del evento
          </DialogTitle>
        </DialogHeader>
        <div className='flex min-w-0 flex-col gap-2'>
          <Label htmlFor='folder-select'>Carpeta</Label>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger
              id='folder-select'
              className='w-full min-w-0 overflow-hidden'
            >
              <SelectValue
                className='min-w-0'
                placeholder='Selecciona una carpeta'
              >
                {hasNoFolder ? (
                  'Sin Carpeta'
                ) : selectedFolder ? (
                  <span className='flex min-w-0 items-center gap-2'>
                    <span
                      className='size-4 shrink-0 rounded-full border border-stroke'
                      style={{ backgroundColor: selectedFolder.color }}
                    />
                    <span className='min-w-0 truncate'>
                      {selectedFolder.name}
                    </span>
                  </span>
                ) : (
                  'Selecciona una carpeta'
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className='w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]'>
              <SelectItem value='none'>
                <span>Sin Carpeta</span>
              </SelectItem>
              {folders?.map((folder) => (
                <SelectItem
                  key={folder.id}
                  value={folder.id}
                  className='min-w-0'
                >
                  <span className='flex min-w-0 items-center gap-2'>
                    <span
                      className='size-4 shrink-0 rounded-full border border-stroke'
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className='min-w-0 truncate'>{folder.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className='min-w-0'>
          <DialogClose asChild>
            <Button variant='ghost' className='w-full sm:w-auto'>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            loading={changeEventFolder.isPending}
            className='w-full max-w-full sm:w-auto'
          >
            {changeEventFolder.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
