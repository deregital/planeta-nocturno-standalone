'use client';
import { format } from 'date-fns';
import {
  BadgeCheck,
  Calendar,
  CopyIcon,
  FileSpreadsheet,
  Folder,
  Link2,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { type Route } from 'next';

import ChangeEventFolder from '@/components/events/admin/ChangeEventFolder';
import DuplicateEventModal from '@/components/events/admin/DuplicateEventModal';
import { FileMarkdown } from '@/components/icons/FileMarkdown';
import { FileSmile } from '@/components/icons/FileSmile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { lightenColor } from '@/lib/utils-client';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function EventCardHorizontal({
  event,
  folderColor,
  showActions = true,
}: {
  event: RouterOutputs['events']['getAll'][
    | 'upcomingEvents'
    | 'pastEvents']['folders'][number]['events'][number];
  folderColor?: string;
  showActions?: boolean;
}) {
  const router = useRouter();
  const session = useSession();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [activateSure, setActivateSure] = useState(false);

  const isAdmin = session.data?.user.role === 'ADMIN';

  const generatePresentismoOrdenAlfPDF =
    trpc.events.generatePresentismoOrderNamePDF.useMutation();

  const generatePresentismoGroupedTicketTypePDF =
    trpc.events.generatePresentismoGroupedTicketTypePDF.useMutation();

  const exportXlsxByTicketType =
    trpc.events.exportXlsxByTicketType.useMutation();

  const toggleActivate = trpc.events.toggleActivate.useMutation();

  const lighterColor = folderColor ? lightenColor(folderColor, 0.2) : undefined;
  const manageHref = `/admin/event/${event.slug}`;

  const handleActivate = () => {
    if (!activateSure) {
      setActivateSure(true);
      return;
    }

    toggleActivate.mutate(
      { id: event.id, isActive: true },
      {
        onError: (error) => {
          toast.error(error.message);
          setActivateSure(false);
        },
        onSuccess: () => {
          setActivateSure(false);
          router.refresh();
        },
      },
    );
  };

  const handleCardClick = () => {
    if (!showActions) return;
    router.push(manageHref as Route<string>);
  };

  return (
    <Card
      variant={'accent'}
      className={cn(
        'flex flex-row items-center rounded-lg py-2',
        'h-20 sm:h-auto sm:min-h-14',
        !showActions && 'border-accent-light py-4',
      )}
      style={{
        backgroundColor: lighterColor || undefined,
      }}
    >
      <CardContent className='flex w-full min-w-0 items-center justify-between gap-2 px-4 text-on-accent'>
        <div
          role={showActions ? 'link' : undefined}
          tabIndex={showActions ? 0 : undefined}
          onClick={showActions ? handleCardClick : undefined}
          onKeyDown={
            showActions
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick();
                  }
                }
              : undefined
          }
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4',
            showActions && 'cursor-pointer',
          )}
        >
          <div className='flex min-w-0 items-center gap-2'>
            {event.isActive && (
              <BadgeCheck className='size-4 shrink-0 text-on-accent' />
            )}
            <CardTitle className='truncate'>{event.name}</CardTitle>
          </div>
          <p className='truncate text-sm'>
            {event.startingDate
              ? format(event.startingDate, 'dd/MM/yyyy HH:mm')
              : null}
            <span className='hidden sm:inline'>
              {event.startingDate && event.location?.address ? ' - ' : ''}
              {event.location?.address}
            </span>
          </p>
        </div>
        {showActions && (
          <div className='flex shrink-0 flex-row items-center gap-0.5'>
            {event.inviteCondition !== 'INVITATION' && (
              <>
                {!event.isActive && (
                  <Button
                    variant='success'
                    size='sm'
                    disabled={toggleActivate.isPending}
                    onClick={handleActivate}
                    className='mr-1'
                  >
                    {activateSure ? '¿Estás seguro?' : 'Activar'}
                  </Button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={'ghost'}
                      size={'icon'}
                      asChild
                      className='hidden sm:inline-flex'
                    >
                      <Link href={`/event/${event.slug}`} target='_blank'>
                        <Link2 className='w-4 h-4 text-on-accent' />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver evento</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={'ghost'} size={'icon'} asChild>
                  <Link
                    href={manageHref as Route<string>}
                    aria-disabled={!isAdmin}
                  >
                    <Calendar className='w-4 h-4 text-on-accent' />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gestionar evento</TooltipContent>
            </Tooltip>
            {isAdmin && (
              <>
                <div className='hidden sm:block'>
                  <DuplicateEventModal
                    eventId={event.id}
                    eventName={event.name}
                  />
                </div>
                <DuplicateEventModal
                  eventId={event.id}
                  eventName={event.name}
                  open={duplicateDialogOpen}
                  onOpenChange={setDuplicateDialogOpen}
                  hideTrigger
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={'ghost'}
                      className='text-on-accent'
                      disabled={!isAdmin}
                      onClick={() =>
                        router.push(`/admin/event/edit/${event.slug}`)
                      }
                    >
                      <Pencil />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar evento</TooltipContent>
                </Tooltip>
                <div className='hidden sm:block'>
                  <ChangeEventFolder
                    eventId={event.id}
                    folderId={event.folderId ?? undefined}
                  />
                </div>
                <ChangeEventFolder
                  eventId={event.id}
                  folderId={event.folderId ?? undefined}
                  open={folderDialogOpen}
                  onOpenChange={setFolderDialogOpen}
                  hideTrigger
                />
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={'ghost'}
                          size={'icon'}
                          className='text-on-accent'
                        >
                          <MoreVertical className='w-4 h-4' />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Más opciones</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align='end'>
                    {event.inviteCondition !== 'INVITATION' && (
                      <DropdownMenuItem
                        asChild
                        className='sm:hidden cursor-pointer'
                      >
                        <Link
                          href={`/event/${event.slug}`}
                          target='_blank'
                          className='flex w-full items-center'
                        >
                          <Link2 className='mr-2 h-4 w-4' />
                          Ver evento
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className='sm:hidden cursor-pointer'
                      onClick={() => setFolderDialogOpen(true)}
                    >
                      <Folder className='mr-2 h-4 w-4' />
                      Cambiar carpeta
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className='sm:hidden cursor-pointer'
                      onClick={() => setDuplicateDialogOpen(true)}
                    >
                      <CopyIcon className='mr-2 h-4 w-4' />
                      Duplicar evento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        generatePresentismoOrdenAlfPDF.mutate(
                          { eventId: event.id },
                          {
                            onError: (error) => {
                              toast.error(error.message);
                            },
                            onSuccess: (pdf) => {
                              const blob = new Blob(
                                [pdf as unknown as ArrayBuffer],
                                {
                                  type: 'application/pdf',
                                },
                              );
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Asistencia ${event.slug}.pdf`;
                              a.click();
                            },
                          },
                        );
                      }}
                      className='cursor-pointer'
                    >
                      <span className='mr-2 inline-flex'>
                        <FileMarkdown />
                      </span>
                      PDF en orden alfabético
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        generatePresentismoGroupedTicketTypePDF.mutate(
                          { eventId: event.id },
                          {
                            onError: (error) => {
                              toast.error(error.message);
                            },
                            onSuccess: (pdf) => {
                              const blob = new Blob(
                                [pdf as unknown as ArrayBuffer],
                                {
                                  type: 'application/pdf',
                                },
                              );
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Asistencia ${event.slug}.pdf`;
                              a.click();
                            },
                          },
                        );
                      }}
                      className='cursor-pointer'
                    >
                      <span className='mr-2 inline-flex'>
                        <FileSmile />
                      </span>
                      PDF agrupado por tipo de ticket
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        await exportXlsxByTicketType.mutateAsync(event.id, {
                          onError: (error) => {
                            toast.error(error.message);
                          },
                          onSuccess: (out) => {
                            const blob = new Blob([out], {
                              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `tickets-${event.slug}.xlsx`;
                            a.click();
                            URL.revokeObjectURL(url);
                          },
                        });
                      }}
                      className='cursor-pointer'
                    >
                      <span className='mr-2 inline-flex'>
                        <FileSpreadsheet />
                      </span>
                      Excel por tipo de ticket
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {!isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={'ghost'}
                    size={'icon'}
                    className='text-on-accent sm:hidden'
                  >
                    <MoreVertical className='w-4 h-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  <DropdownMenuItem asChild className='cursor-pointer'>
                    <Link
                      href={`/event/${event.slug}`}
                      target='_blank'
                      className='flex w-full items-center'
                    >
                      <Link2 className='mr-2 h-4 w-4' />
                      Ver evento
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
