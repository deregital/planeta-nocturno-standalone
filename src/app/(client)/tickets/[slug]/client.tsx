'use client';

import type { RouterOutputs } from '@/server/routers/app';

import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';

import GoBack from '@/components/common/GoBack';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { trpc } from '@/server/trpc/client';

type TicketsForDownload =
  RouterOutputs['ticketGroup']['getTicketsForDownloadPage'];

export default function TicketsClient({
  ticketGroupId,
  tickets,
}: {
  ticketGroupId: string;
  tickets: TicketsForDownload['tickets'];
}) {
  const utils = trpc.useUtils();
  const [isDownloading, setIsDownloading] = useState(false);

  function downloadPdf(pdfBase64: string, fileName: string) {
    try {
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  }

  async function downloadAllPdfs() {
    if (!tickets?.length) return;
    setIsDownloading(true);
    try {
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const result = await utils.ticketGroup.getPdfByEmittedTicketId.fetch({
          ticketGroupId,
          emittedTicketId: ticket.id,
        });
        downloadPdf(
          result.base64,
          `ticket-${i + 1}-${ticket.slug ?? ticket.id}.pdf`,
        );
      }
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className='flex justify-center items-center h-full'>
      <GoBack
        route='/'
        title='Volver al inicio'
        className='absolute top-24 md:left-26 left-4'
      />
      <Card className='max-w-md mx-auto text-center shadow-lg m-4'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            ¡Gracias por su compra!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            Ya podés descargar tus tickets. También fueron enviados a tu email.
          </p>
        </CardContent>
        <CardFooter className='justify-center'>
          <Button
            variant='accent'
            onClick={() => downloadAllPdfs()}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Download className='mr-2 h-4 w-4' />
            )}
            {isDownloading ? 'Descargando...' : 'Descargar Tickets'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
