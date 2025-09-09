'use client';

import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownAZ,
  DownloadIcon,
  MoreHorizontal,
  ScanBarcode,
  SendIcon,
  TrashIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

import { downloadTicket } from '@/app/admin/event/[slug]/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export function generateTicketColumns() {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const session = useSession();
  const isAdmin = session.data?.user.role === 'ADMIN';

  const columns: ColumnDef<
    RouterOutputs['emittedTickets']['getByEventId'][number]
  >[] = [
    {
      id: 'ticketType',
      accessorKey: 'ticketType',
      header: ({ column }) => {
        return (
          <div
            className='mx-auto w-full'
            style={{
              width: `${column.getSize()}px`,
            }}
          >
            Tipo
          </div>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <div className='flex items-center justify-center gap-2 text-sm'>
            <span>{row.original.ticketType.name}</span>
          </div>
        );
      },
    },
    {
      id: 'fullName',
      accessorKey: 'fullName',
      sortingFn: 'text',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 mx-auto'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Nombre
            <ArrowDownAZ
              className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
            />
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return <p className='w-full capitalize'>{row.original.fullName}</p>;
      },
    },
    {
      id: 'mail',
      accessorKey: 'mail',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Correo
            <ArrowDownAZ
              className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
            />
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return <p className='w-full text-center'>{row.original.mail}</p>;
      },
    },
    {
      id: 'scanned',
      accessorKey: 'scanned',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Usado
            <ArrowDownAZ
              className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
            />
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <div className='flex items-center justify-center'>
            <Input
              /* disabled */
              type='checkbox'
              className='size-6'
              readOnly
              checked={row.original.scanned}
            />
          </div>
        );
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      size: 20,
      cell: ({ row }) => {
        const ticket = row.original;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [sure, setSure] = useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [open, setOpen] = useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const router = useRouter();
        const deleteTicketMutation = trpc.emittedTickets.delete.useMutation({
          onSuccess: () => {
            router.refresh();
          },
        });
        const sendTicketMutation = trpc.emittedTickets.send.useMutation({
          onSuccess: () => {
            toast.success('Ticket enviado con éxito');
          },
          onError: (error) => {
            toast.error(error.message);
          },
        });
        const manualScanTicketMutation =
          trpc.emittedTickets.manualScan.useMutation({
            onError: (error) => {
              toast.error(error.message);
            },
            onSuccess: () => {
              router.refresh();
            },
          });
        const utils = trpc.useUtils();

        return (
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                className='h-8 w-8 p-0 hover:bg-gray-500/20'
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={sendTicketMutation.isPending}
                className='flex cursor-pointer items-center justify-between'
                onClick={async (e) => {
                  e.preventDefault();
                  await sendTicketMutation.mutateAsync({ ticketId: ticket.id });
                  setOpen(false);
                }}
              >
                <span>Reenviar</span>
                <SendIcon />
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={deleteTicketMutation.isPending}
                className='flex cursor-pointer items-center justify-between'
                onClick={async (e) => {
                  e.preventDefault();
                  toast.loading('Descargando ticket...', {
                    id: `downloading-ticket-${ticket.id}`,
                  });
                  const pdf = await downloadTicket(ticket.id);
                  if (pdf) {
                    const url = URL.createObjectURL(pdf);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Ticket-${ticket.fullName}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    URL.revokeObjectURL(url);
                    setOpen(false);
                    toast.dismiss(`downloading-ticket-${ticket.id}`);
                  } else {
                    toast.error('Error al descargar ticket');
                  }
                }}
              >
                Descargar
                <DownloadIcon className='size-4' />
              </DropdownMenuItem>
              <DropdownMenuItem
                className='flex cursor-pointer items-center justify-between'
                onClick={() => {
                  if (ticket.scanned) {
                    toast.error('Ticket ya escaneado');
                    return;
                  }
                  manualScanTicketMutation.mutate({
                    ticketId: ticket.id,
                  });
                  utils.emittedTickets.getByEventId.invalidate({
                    eventId: ticket.eventId ?? '',
                  });
                  utils.events.getById.invalidate(ticket.eventId ?? '');
                }}
                disabled={row.original.scanned}
              >
                Escaneo manual
                <ScanBarcode className='size-5' />
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async (e) => {
                  e.preventDefault();
                  if (sure) {
                    await deleteTicketMutation.mutateAsync({
                      ticketId: ticket.id,
                    });
                    setSure(false);
                    setOpen(false);
                    utils.emittedTickets.getByEventId.invalidate({
                      eventId: ticket.eventId ?? '',
                    });
                    utils.events.getById.invalidate(ticket.eventId ?? '');
                    return;
                  }
                  setSure(true);
                }}
                data-sure={sure}
                disabled={deleteTicketMutation.isPending || !isAdmin}
                className='-mx-1 -mb-1 cursor-pointer bg-red-500 px-3 text-white focus:hover:bg-red-600 focus:hover:text-white data-[sure="true"]:bg-red-600 data-[sure="true"]:hover:bg-red-700 flex justify-between'
              >
                {sure ? 'Estás seguro?' : 'Eliminar ticket'}
                <TrashIcon className='text-white' />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return columns;
}
