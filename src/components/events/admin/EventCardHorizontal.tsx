'use client';
import { format } from 'date-fns';
import {
  BadgeCheck,
  Calendar,
  FileSpreadsheet,
  Link2,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import ChangeEventFolder from '@/components/events/admin/ChangeEventFolder';
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
        'flex flex-row py-2 rounded-lg',
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
            <Button variant={'ghost'} size={'icon'} asChild>
              <Link href={`/event/${event.slug}`} target='_blank'>
                <Link2 className='w-4 h-4 text-on-accent' />
              </Link>
            </Button>
            <Button variant={'ghost'} size={'icon'} asChild>
              <Link
                href={`/admin/event/${event.slug}`}
                aria-disabled={!isAdmin}
              >
                <Calendar className='w-4 h-4 text-on-accent' />
              </Link>
            </Button>

            <Button
              variant={'ghost'}
              className='text-on-accent'
              disabled={!isAdmin}
              onClick={() => router.push(`/admin/event/edit/${event.slug}`)}
            >
              <Pencil />
            </Button>
            <ChangeEventFolder
              eventId={event.id}
              folderId={event.folderId ?? undefined}
            />
            {isAdmin && (
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
