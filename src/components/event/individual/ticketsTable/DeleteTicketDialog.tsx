'use client';
import { TrashIcon } from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/server/trpc/client';

const REASON_MAX_LENGTH = 500;

/**
 * Elimina una entrada pidiendo el motivo: pasa a la papelera del evento, deja
 * de escanearse y de contar, y quien la escanee ve el motivo.
 */
export function DeleteTicketDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: { id: string; fullName: string; eventId: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const router = useRouter();
  const utils = trpc.useUtils();
  const deleteTicket = trpc.emittedTickets.delete.useMutation({
    onSuccess: () => {
      toast.success('Entrada enviada a la papelera');
      utils.emittedTickets.getByEventId.invalidate({ eventId: ticket.eventId });
      utils.emittedTickets.getTrash.invalidate({ eventId: ticket.eventId });
      utils.events.getById.invalidate(ticket.eventId);
      setReason('');
      onOpenChange(false);
      // Las métricas del evento salen del render del servidor.
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const trimmed = reason.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && deleteTicket.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Eliminar entrada</DialogTitle>
          <DialogDescription className='break-words'>
            La entrada de <span className='font-bold'>{ticket.fullName}</span>{' '}
            va a la papelera del evento: deja de valer en la puerta y no cuenta
            en las tablas, estadísticas ni en el cupo. Se puede restaurar desde
            la papelera.
          </DialogDescription>
        </DialogHeader>
        <form
          className='flex flex-col gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            if (!trimmed || deleteTicket.isPending) return;
            deleteTicket.mutate({ ticketId: ticket.id, reason: trimmed });
          }}
        >
          <Label htmlFor={`delete-reason-${ticket.id}`}>
            Razón de la eliminación
          </Label>
          <Textarea
            id={`delete-reason-${ticket.id}`}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Ej.: pidió el reembolso'
            autoFocus
          />
          <p className='text-muted-foreground text-xs'>
            Lo ve quien escanee la entrada.
          </p>
          <DialogFooter className='mt-2 flex-wrap gap-2'>
            <DialogClose asChild>
              <Button type='button' variant='ghost'>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type='submit'
              variant='destructive'
              disabled={!trimmed}
              loading={deleteTicket.isPending}
            >
              <TrashIcon />
              Eliminar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
