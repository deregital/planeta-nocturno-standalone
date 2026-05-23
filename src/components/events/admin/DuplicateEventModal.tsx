'use client';

import { CopyIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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

export default function DuplicateEventModal({
  eventId,
  eventName,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger = false,
}: {
  eventId: string;
  eventName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChangeProp ?? setInternalOpen;

  const duplicateEvent = trpc.events.duplicate.useMutation({
    onSuccess: () => {
      toast.success('Evento duplicado correctamente');
      setOpen(false);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant={'ghost'} size={'icon'}>
            <CopyIcon className='w-4 h-4 text-on-accent' />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogTitle className='text-lg font-bold'>
          ¿Duplicar este evento?
        </DialogTitle>
        <DialogDescription>
          Se creará una copia de <span className='font-bold'>{eventName}</span>{' '}
          con el nombre &quot;{eventName} (copia)&quot;. La copia quedará
          desactivada de la ticketera hasta que la actives.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant={'ghost'}>Cancelar</Button>
          </DialogClose>
          <Button
            onClick={() => duplicateEvent.mutate(eventId)}
            disabled={duplicateEvent.isPending}
          >
            Duplicar evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
