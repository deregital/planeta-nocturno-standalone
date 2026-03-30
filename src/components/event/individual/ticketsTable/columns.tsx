'use client';

import { type StrictColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { format as formatPhoneNumber } from 'libphonenumber-js';
import {
  ArrowDownAZ,
  ArrowUpDown,
  DownloadIcon,
  MoreHorizontal,
  ScanBarcode,
  SendIcon,
  TrashIcon,
  UserCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { downloadTicket } from '@/app/(backoffice)/admin/event/[slug]/actions';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { VirtualizedCombobox } from '@/components/ui/virtualized-combobox';
import { cn } from '@/lib/utils';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { type InviteCondition, type Role } from '@/server/types';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export function generateTicketColumns({
  role,
  event,
}: {
  role: Role;
  event: {
    inviteCondition: InviteCondition;
    hasSimpleInvitation: boolean;
  };
}) {
  let columns: StrictColumnDef<
    RouterOutputs['emittedTickets']['getByEventId'][number]
  >[] = [
    {
      id: 'buyerCode',
      accessorKey: 'buyerCode',
      header: ({ column }) => {
        return <div className='mx-auto w-full'>ID</div>;
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <div className='flex items-center justify-center gap-2 text-sm'>
            <span>{row.original.buyerCode}</span>
          </div>
        );
      },
      meta: {
        exportValue: (row) => row.original.buyerCode,
        exportHeader: 'ID',
      },
    },
    {
      id: 'scanned',
      accessorKey: 'scanned',
      meta: {
        exportValue: (row) => (row.original.scanned ? 'Sí' : 'No'),
        exportHeader: 'Ingresó',
      },
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Ingresó
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
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
      id: 'scannedAt',
      accessorKey: 'scannedAt',
      meta: {
        exportValue: (row) =>
          row.original.scannedAt
            ? formatInTimeZone(
                new Date(row.original.scannedAt),
                'America/Argentina/Buenos_Aires',
                'HH:mm:ss',
              )
            : '-',
        exportHeader: 'Hora de ingreso',
      },
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Hora de ingreso
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {row.original.scannedAt
              ? formatInTimeZone(
                  new Date(row.original.scannedAt),
                  'America/Argentina/Buenos_Aires',
                  'HH:mm:ss',
                )
              : '-'}
          </p>
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
            className='pl-0 mx-auto font-bold'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Nombre
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
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
      meta: {
        exportValue: (row) => row.original.fullName,
        exportHeader: 'Nombre',
      },
    },
    {
      id: 'birthDate',
      accessorKey: 'birthDate',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Fecha de nacimiento
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {format(row.original.birthDate, 'dd/MM/yyyy')}
          </p>
        );
      },
      meta: {
        exportValue: (row) => row.original.birthDate,
        exportHeader: 'Fecha de nacimiento',
      },
    },
    {
      id: 'dni',
      accessorKey: 'dni',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            DNI
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        return <p className='w-full text-center'>{row.original.dni}</p>;
      },
      meta: {
        exportValue: (row) => row.original.dni,
        exportHeader: 'DNI',
      },
    },
    {
      id: 'phoneNumber',
      accessorKey: 'phoneNumber',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
          >
            Teléfono
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <a
            href={`https://wa.me/${row.original.phoneNumber}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm p-2 underline text-blue-500 hover:text-blue-500/75'
          >
            {formatPhoneNumber(row.original.phoneNumber, 'INTERNATIONAL')}
          </a>
        );
      },
      meta: {
        exportValue: (row) => row.original.phoneNumber,
        exportHeader: 'Teléfono',
      },
    },
    {
      id: 'mail',
      accessorKey: 'mail',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Correo
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        return <p className='w-full text-center'>{row.original.mail}</p>;
      },
      meta: {
        exportValue: (row) => row.original.mail,
        exportHeader: 'Correo',
      },
    },
    {
      id: 'instagram',
      accessorKey: 'instagram',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Instagram
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        const instagram = row.original.instagram?.replace(/^@/, '') ?? null;
        return instagram ? (
          <a
            href={`https://instagram.com/${instagram}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm p-2 underline text-blue-500 hover:text-blue-500/75'
          >
            @{instagram}
          </a>
        ) : (
          <p className='w-full text-center'>-</p>
        );
      },
      meta: {
        exportValue: (row) => row.original.instagram || '-',
        exportHeader: 'Instagram',
      },
    },
    {
      id: 'invitedBySimple',
      accessorKey: 'invitedBySimple',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Invita
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: true,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {row.original.ticketGroup.invitedBySimple || '-'}
          </p>
        );
      },
      meta: {
        exportValue: (row) => row.original.ticketGroup.invitedBySimple || '-',
        exportHeader: 'Invita',
      },
    },
    {
      id: 'invitedBy',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='text-sm text-center p-2 font-bold w-full'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Organizador
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      accessorFn: (row) => row.ticketGroup.invitedBy,
      minSize: 30,
      size: 30,
      maxSize: 30,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {row.original.ticketGroup.invitedBy || '-'}
          </p>
        );
      },
      meta: {
        exportValue: (row) => row.original.ticketGroup.invitedBy || '-',
        exportHeader: 'Organizador',
      },
    },
    {
      id: 'chiefOrganizer',
      accessorFn: (row) => row.ticketGroup.user?.user?.fullName,
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Jefe del Organizador
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {row.original.ticketGroup.user?.user?.fullName || '-'}
          </p>
        );
      },
      meta: {
        exportValue: (row) =>
          row.original.ticketGroup.user?.user?.fullName || '-',
        exportHeader: 'Jefe del Organizador',
      },
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      meta: {
        exportValue: (row) =>
          row.original.createdAt
            ? formatInTimeZone(
                new Date(row.original.createdAt),
                'America/Argentina/Buenos_Aires',
                'dd/MM/yyyy HH:mm:ss',
              )
            : '-',
        exportHeader: 'Fecha de emisión',
      },
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='pl-0 text-center w-full font-bold text-sm'
            onClick={() =>
              column.getIsSorted() === 'desc'
                ? column.clearSorting()
                : column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Fecha de emisión
            {column.getIsSorted() ? (
              <ArrowDownAZ
                className={cn(column.getIsSorted() === 'asc' && 'rotate-180')}
              />
            ) : (
              <ArrowUpDown />
            )}
          </Button>
        );
      },
      minSize: 50,
      size: 50,
      maxSize: 50,
      enableResizing: false,
      cell: ({ row }) => {
        return (
          <p className='w-full text-center'>
            {row.original.createdAt
              ? formatInTimeZone(
                  new Date(row.original.createdAt),
                  'America/Argentina/Buenos_Aires',
                  'dd/MM/yyyy HH:mm:ss',
                )
              : '-'}
          </p>
        );
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      size: 10,
      meta: {
        exportValue: () => '',
        exportHeader: 'Acciones',
      },
      cell: ({ row }) => {
        const ticket = row.original;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [sure, setSure] = useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [open, setOpen] = useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [openOrganizerModal, setOpenOrganizerModal] = useState(false);
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [selectedComboboxOption, setSelectedComboboxOption] = useState<
          string | null
        >(null);
        const utils = trpc.useUtils();
        const deleteTicketMutation = trpc.emittedTickets.delete.useMutation({
          onSuccess: () => {
            utils.emittedTickets.getByEventId.invalidate();
            toast.success('Ticket eliminado con éxito');
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
              utils.emittedTickets.getByEventId.invalidate();
              toast.success('Ticket escaneado manualmente con éxito');
            },
          });
        const updateInvitedByMutation =
          trpc.ticketGroup.updateInvitedBy.useMutation({
            onSuccess: () => {
              utils.emittedTickets.getByEventId.invalidate({
                eventId: ticket.eventId ?? '',
              });
              utils.events.getById.invalidate(ticket.eventId ?? '');
              setOpen(false);
              toast.success('Organizador del ticket actualizado');
              // Cierre suave: dar tiempo a ver el toast y a la animación
              setTimeout(() => {
                setOpenOrganizerModal(false);
                setSelectedComboboxOption(null);
              }, 400);
            },
            onError: (error) => {
              toast.error(error.message);
            },
          });
        const eventQuery = trpc.events.getById.useQuery(ticket.eventId ?? '', {
          enabled: openOrganizerModal && !!ticket.eventId && role === 'ADMIN',
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const organizerOptions = useMemo(() => {
          const base = [{ value: '', label: 'Sin organizador' }];
          const data = eventQuery.data as
            | {
                eventXorganizers?: Array<{
                  organizerId: string;
                  user: {
                    id: string;
                    fullName: string | null;
                    dni?: string;
                    email?: string;
                  };
                }>;
              }
            | undefined;
          const organizers =
            data?.eventXorganizers?.map((exo) => ({
              value: exo.user.id,
              label: exo.user.fullName ?? exo.organizerId,
            })) ?? [];
          return [...base, ...organizers];
        }, [eventQuery.data]);

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const previewOrganizer = useMemo(() => {
          if (selectedComboboxOption === null) return null;
          if (selectedComboboxOption === '') {
            return { type: 'none' as const };
          }
          const data = eventQuery.data as
            | {
                eventXorganizers?: Array<{
                  user: {
                    id: string;
                    fullName: string | null;
                    dni?: string;
                    email?: string;
                  };
                }>;
              }
            | undefined;
          const user = data?.eventXorganizers?.find(
            (exo) => exo.user.id === selectedComboboxOption,
          )?.user;
          return user ? { type: 'organizer' as const, user } : null;
        }, [eventQuery.data, selectedComboboxOption]);

        return (
          <>
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
                    await sendTicketMutation.mutateAsync({
                      ticketId: ticket.id,
                    });
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
                    const result = await downloadTicket(ticket.id);
                    if (result?.base64) {
                      const byteCharacters = atob(result.base64);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const blob = new Blob([new Uint8Array(byteNumbers)], {
                        type: 'application/pdf',
                      });
                      const url = URL.createObjectURL(blob);

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
                {(role === 'ADMIN' || role === 'TICKETING') && (
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
                )}
                {role === 'ADMIN' &&
                  ticket.ticketType.name.trim() !==
                    ORGANIZER_TICKET_TYPE_NAME && (
                    <DropdownMenuItem
                      className='flex cursor-pointer items-center justify-between'
                      onClick={(e) => {
                        e.preventDefault();
                        setOpen(false);
                        setSelectedComboboxOption(
                          ticket.ticketGroup.invitedById,
                        );
                        setOpenOrganizerModal(true);
                      }}
                    >
                      <span>Cambiar organizador</span>
                      <UserCircle className='size-4' />
                    </DropdownMenuItem>
                  )}
                {role === 'ADMIN' && (
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
                    disabled={
                      deleteTicketMutation.isPending || role !== 'ADMIN'
                    }
                    className='-mx-1 -mb-1 cursor-pointer bg-red-500 px-3 text-white focus:hover:bg-red-600 focus:hover:text-white data-[sure="true"]:bg-red-600 data-[sure="true"]:hover:bg-red-700 flex justify-between'
                  >
                    {sure ? 'Estás seguro?' : 'Eliminar ticket'}
                    <TrashIcon className='text-white' />
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {role === 'ADMIN' && (
              <Dialog
                open={openOrganizerModal}
                onOpenChange={(open) => {
                  setOpenOrganizerModal(open);
                  if (!open) {
                    setSelectedComboboxOption(null);
                  }
                }}
              >
                <DialogContent
                  className='max-w-xl! md:max-w-3xl! w-full'
                  onInteractOutside={(e) => {
                    // No cerrar si el clic fue en el popover del combobox
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-slot="popover-content"]')) {
                      e.preventDefault();
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Asignar organizador al ticket</DialogTitle>
                    <DialogDescription>
                      Elegí el organizador que invitó a esta persona.
                    </DialogDescription>
                  </DialogHeader>

                  <div className='flex flex-col gap-4'>
                    <VirtualizedCombobox
                      searchPlaceholder='Buscar organizador del evento...'
                      notFoundPlaceholder='No hay más organizadores disponibles'
                      options={organizerOptions}
                      selectedOption={selectedComboboxOption ?? ''}
                      onSelectedOptionChange={(value) =>
                        setSelectedComboboxOption(value)
                      }
                      onSelectOption={(value) =>
                        setSelectedComboboxOption(value)
                      }
                      showSelectedOptions={false}
                      width='100%'
                    />

                    {previewOrganizer && (
                      <div className='rounded-md border bg-muted/30 p-4'>
                        {previewOrganizer.type === 'none' ? (
                          <p className='text-sm'>Sin organizador asignado</p>
                        ) : (
                          <dl className='grid gap-1 text-sm'>
                            <div>
                              <dt className='text-muted-foreground inline font-medium'>
                                Nombre:{' '}
                              </dt>
                              <dd className='inline'>
                                {previewOrganizer.user.fullName ?? '-'}
                              </dd>
                            </div>
                            <div>
                              <dt className='text-muted-foreground inline font-medium'>
                                DNI:{' '}
                              </dt>
                              <dd className='inline'>
                                {previewOrganizer.user.dni ?? '-'}
                              </dd>
                            </div>
                            <div>
                              <dt className='text-muted-foreground inline font-medium'>
                                Mail:{' '}
                              </dt>
                              <dd className='inline'>
                                {previewOrganizer.user.email ?? '-'}
                              </dd>
                            </div>
                          </dl>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant='outline'>Cerrar</Button>
                    </DialogClose>
                    {previewOrganizer && (
                      <Button
                        disabled={updateInvitedByMutation.isPending}
                        onClick={() => {
                          updateInvitedByMutation.mutate({
                            id: ticket.ticketGroupId,
                            invitedBy: selectedComboboxOption ?? '',
                          });
                        }}
                      >
                        Asignar
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        );
      },
    },
  ];

  if (event.inviteCondition === 'SIMPLE') {
    columns = columns.filter(
      (col) => col.id !== 'invitedBy' && col.id !== 'chiefOrganizer',
    );
  }

  if (event.inviteCondition !== 'SIMPLE' && !event.hasSimpleInvitation) {
    columns = columns.filter((col) => col.id !== 'invitedBySimple');
  }

  if (role === 'ORGANIZER' || role === 'CHIEF_ORGANIZER') {
    columns = columns.filter((col) => col.id !== 'chiefOrganizer');
  }

  if (role === 'ORGANIZER') {
    columns = columns.filter((col) => col.id !== 'invitedBy');
  }

  return columns;
}
