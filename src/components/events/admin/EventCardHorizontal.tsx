import { format } from 'date-fns';
import { BadgeCheck, Calendar, Link2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';

import { FileMarkdown } from '@/components/icons/FileMarkdown';
import { FileSmile } from '@/components/icons/FileSmile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';

export default function EventCardHorizontal({
  event,
}: {
  event: RouterOutputs['events']['getAll'][number];
}) {
  const router = useRouter();
  const session = useSession();

  const isAdmin = session.data?.user.role === 'ADMIN';

  const generatePresentismoOrdenAlfPDF =
    trpc.events.generatePresentismoOrderNamePDF.useMutation();

  const generatePresentismoGroupedTicketTypePDF =
    trpc.events.generatePresentismoGroupedTicketTypePDF.useMutation();

  return (
    <Card variant={'accent'} className='flex flex-row py-2 rounded-lg'>
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
        <div className='flex flex-row gap-0.5 items-center'>
          <Button variant={'ghost'} size={'icon'} asChild>
            <Link href={`/event/${event.slug}`} target='_blank'>
              <Link2 className='w-4 h-4 text-on-accent' />
            </Link>
          </Button>
          <Button variant={'ghost'} size={'icon'} asChild>
            <Link href={`/admin/event/${event.slug}`} aria-disabled={!isAdmin}>
              <Calendar className='w-4 h-4 text-on-accent' />
            </Link>
          </Button>
          <Button
            title='Generar presentismo por orden alfabético'
            size={'icon'}
            variant={'ghost'}
            disabled={!isAdmin}
            onClick={() => {
              generatePresentismoOrdenAlfPDF.mutate(
                { eventId: event.id },
                {
                  onError: (error) => {
                    toast.error(error.message);
                  },
                  onSuccess: (pdf) => {
                    // download pdf
                    const blob = new Blob([pdf], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Asistencia ${event.slug}.pdf`;
                    a.click();
                  },
                },
              );
            }}
            className='text-on-accent'
          >
            <FileMarkdown />
          </Button>

          <Button
            className='text-on-accent'
            variant={'ghost'}
            size={'icon'}
            disabled={!isAdmin}
            onClick={() => {
              generatePresentismoGroupedTicketTypePDF.mutate(
                { eventId: event.id },
                {
                  onError: (error) => {
                    toast.error(error.message);
                  },
                  onSuccess: (pdf) => {
                    // download pdf
                    const blob = new Blob([pdf!], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Asistencia ${event.slug}.pdf`;
                    a.click();
                  },
                },
              );
            }}
          >
            <FileSmile />
          </Button>

          <Button
            variant={'ghost'}
            className='text-on-accent'
            disabled={!isAdmin}
            onClick={() => router.push(`/admin/event/edit/${event.slug}`)}
          >
            <Pencil />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
