import { FileMarkdown } from '@/components/icons/FileMarkdown';
import { FileSmile } from '@/components/icons/FileSmile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { format } from 'date-fns';
import { Calendar, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function EventCardHorizontal({
  event,
}: {
  event: RouterOutputs['events']['getAll'][number];
}) {
  const router = useRouter();
  const generatePresentismoOrdenAlfPDF =
    trpc.events.generatePresentismoOrderNamePDF.useMutation();

  const generatePresentismoGroupedTicketTypePDF =
    trpc.events.generatePresentismoGroupedTicketTypePDF.useMutation();

  return (
    <Card className='flex flex-row bg-pn-accent py-2 rounded-lg'>
      <CardContent className='flex w-full justify-between px-4 text-pn-text-accent'>
        <div className='flex flex-row gap-4 items-center'>
          <CardTitle>{event.name}</CardTitle>
          <p className='text-sm'>
            {format(event.startingDate, 'dd/MM/yyyy HH:mm')} -{' '}
            {event.location.address}
          </p>
        </div>
        <div className='flex flex-row gap-0.5 items-center'>
          <Button variant={'ghost'} size={'icon'} asChild>
            <Link href={`/admin/event/${event.slug}`}>
              <Calendar className='w-4 h-4' />
            </Link>
          </Button>
          <Button
            title='Generar presentismo por orden alfabético'
            variant={'ghost'}
            size={'icon'}
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
          >
            <FileMarkdown />
          </Button>

          <Button
            variant={'ghost'}
            size={'icon'}
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
            onClick={() => router.push(`/admin/event/edit/${event.slug}`)}
          >
            <Pencil />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
