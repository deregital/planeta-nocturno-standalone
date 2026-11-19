'use client';
import {
  ArchiveRestore,
  ChevronDown,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatZonedDateTime } from '@/lib/format-date';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

type TrashedTicket = RouterOutputs['emittedTickets']['getTrash'][number];

/**
 * Papelera del evento: las entradas eliminadas con el motivo, quién y cuándo.
 * No valen en la puerta ni cuentan en tablas, estadísticas ni cupo hasta que
 * se restauran. Filas compactas y lista con scroll propio: el buscador y el
 * contador quedan siempre a la vista aunque haya cientos.
 */
export function TicketTrashModal({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const trash = trpc.emittedTickets.getTrash.useQuery(
    { eventId },
    { enabled: open },
  );

  const total = trash.data?.length ?? 0;
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return trash.data ?? [];
    return (trash.data ?? []).filter((ticket) =>
      [
        ticket.fullName,
        ticket.dni,
        ticket.mail,
        ticket.ticketTypeName,
        `#${ticket.shortId}`,
        ticket.deletionReason,
        ticket.deletedByName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [trash.data, term]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' className='w-full'>
          <Trash2 className='size-4' />
          Papelera
        </Button>
      </DialogTrigger>
      {/* Columna flex: la lista toma el alto que sobra y scrollea sola. */}
      <DialogContent className='flex flex-col sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Papelera de entradas</DialogTitle>
          {/* Con el teclado abierto le deja el lugar a la lista. */}
          <DialogDescription className='[@media(max-height:480px)]:sr-only'>
            No valen en la puerta (quien las escanee ve el motivo) ni cuentan en
            tablas, estadísticas ni en el cupo.
          </DialogDescription>
        </DialogHeader>

        {total > 0 && (
          <div className='flex items-center gap-3'>
            <div className='relative min-w-0 flex-1'>
              <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Nombre, DNI, mail o motivo'
                className='pl-9'
              />
            </div>
            <p className='text-muted-foreground shrink-0 text-xs'>
              {term
                ? `${filtered.length} de ${total}`
                : `${total} ${total === 1 ? 'eliminada' : 'eliminadas'}`}
            </p>
          </div>
        )}

        {trash.isLoading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='text-accent size-6 animate-spin' />
          </div>
        ) : trash.error ? (
          <p className='text-sm text-red-500'>{trash.error.message}</p>
        ) : total === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            La papelera está vacía.
          </p>
        ) : filtered.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            Ninguna entrada coincide con la búsqueda.
          </p>
        ) : (
          <ul className='border-stroke min-h-0 flex-1 divide-y overflow-y-auto rounded-md border'>
            {filtered.map((ticket) => (
              <TrashedTicketRow
                key={ticket.id}
                ticket={ticket}
                eventId={eventId}
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrashedTicketRow({
  ticket,
  eventId,
}: {
  ticket: TrashedTicket;
  eventId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [sure, setSure] = useState(false);
  const router = useRouter();
  const utils = trpc.useUtils();
  const restore = trpc.emittedTickets.restore.useMutation({
    onSuccess: () => {
      toast.success(`Entrada de ${ticket.fullName} restaurada`);
      utils.emittedTickets.getTrash.invalidate({ eventId });
      utils.emittedTickets.getByEventId.invalidate({ eventId });
      utils.events.getById.invalidate(eventId);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
      setSure(false);
    },
  });

  const deletedAt = formatZonedDateTime(
    ticket.deletedAt,
    TIME_ZONE,
    'dd/MM HH:mm',
  );

  return (
    <li className='flex min-w-0 items-start gap-2 px-3 py-2'>
      <button
        type='button'
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className='flex min-w-0 flex-1 flex-col gap-0.5 text-left'
      >
        <span className='flex min-w-0 items-center gap-1.5'>
          <span className='truncate font-semibold capitalize'>
            {ticket.fullName}
          </span>
          <span className='text-muted-foreground shrink-0 text-xs'>
            #{ticket.shortId}
          </span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </span>
        <span className='text-muted-foreground truncate text-xs'>
          DNI {ticket.dni} · {ticket.ticketTypeName ?? '-'} · {deletedAt}
        </span>
        <span
          className={cn(
            'text-sm break-words',
            expanded ? 'whitespace-pre-line' : 'line-clamp-1',
          )}
        >
          <span className='font-medium'>Motivo: </span>
          {ticket.deletionReason}
        </span>
        {expanded && (
          <span className='text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs break-words'>
            <span>{ticket.mail}</span>
            <span>
              Eliminada el{' '}
              {formatZonedDateTime(
                ticket.deletedAt,
                TIME_ZONE,
                'dd/MM/yyyy HH:mm',
              )}
              {ticket.deletedByName ? ` por ${ticket.deletedByName}` : ''}
            </span>
            {ticket.scanned && <span>Ya había ingresado</span>}
          </span>
        )}
      </button>
      <Button
        variant={sure ? 'success' : 'outline'}
        size='sm'
        className='shrink-0'
        loading={restore.isPending}
        aria-label={`Restaurar la entrada de ${ticket.fullName}`}
        onClick={() => {
          if (!sure) {
            setSure(true);
            return;
          }
          restore.mutate({ ticketId: ticket.id, eventId });
        }}
        onBlur={() => {
          if (!restore.isPending) setSure(false);
        }}
      >
        <ArchiveRestore className='size-4' />
        {sure ? (
          '¿Restaurar?'
        ) : (
          <span className='hidden sm:inline'>Restaurar</span>
        )}
      </Button>
    </li>
  );
}
