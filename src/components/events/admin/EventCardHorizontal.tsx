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

  const isAdmin = session.data?.user.role === 'ADMIN';

  const generatePresentismoOrdenAlfPDF =
    trpc.events.generatePresentismoOrderNamePDF.useMutation();

  const generatePresentismoGroupedTicketTypePDF =
    trpc.events.generatePresentismoGroupedTicketTypePDF.useMutation();

  const exportXlsxByTicketType =
    trpc.events.exportXlsxByTicketType.useMutation();

  const lighterColor = folderColor ? lightenColor(folderColor, 0.2) : undefined;

  return (
    <Card
      variant={'accent'}
      className={cn(
        'flex flex-row py-2 rounded-lg min-h-14',
        !showActions && 'border-accent-light py-4',
      )}
      style={{
        backgroundColor: lighterColor || undefined,
      }}
    >
      <CardContent className='flex w-full justify-between px-4 text-on-accent'>
        <div className='flex sm:flex-row flex-col sm:gap-4 gap-2 sm:items-center'>
          <div className='flex flex-row items-center gap-2'>
            {event.isActive && <BadgeCheck className='text-on-accent' />}
            <CardTitle>{event.name}</CardTitle>
          </div>
          <p className='text-sm'>
            {format(event.startingDate, 'dd/MM/yyyy HH:mm')} -{' '}
            {event.location.address}
          </p>
        </div>
        {showActions && (
          <div className='flex flex-row gap-0.5 items-center'>
            {event.inviteCondition !== 'INVITATION' && (
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
            )}
            <Button variant={'ghost'} size={'icon'} asChild>
              <Link
                href={`/admin/event/${event.slug}`}
                aria-disabled={!isAdmin}
              >
                <Calendar className='w-4 h-4 text-on-accent' />
              </Link>
            </Button>
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
                <Button
                  variant={'ghost'}
                  className='text-on-accent'
                  disabled={!isAdmin}
                  onClick={() => router.push(`/admin/event/edit/${event.slug}`)}
                >
                  <Pencil />
                </Button>
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
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={'ghost'}
                      size={'icon'}
                      className='text-on-accent'
                    >
                      <MoreVertical className='w-4 h-4' />
                    </Button>
                  </DropdownMenuTrigger>
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
