'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type RouterOutputs } from '@/server/routers/app';
import { Download } from 'lucide-react';

export default function TicketsClient({
  pdfs,
}: {
  pdfs: RouterOutputs['ticketGroup']['generatePdfsByTicketGroupId'];
}) {
  const downloadPdf = (pdfBase64: string, ticketId: string) => {
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
      link.download = `ticket-${ticketId}.pdf`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const downloadAllPdfs = () => {
    if (pdfs && pdfs.length > 0) {
      pdfs.forEach(async (pdf) => {
        downloadPdf(pdf.pdf.base64, 'prueba');
      });
    }
  };

  return (
    <div className='flex justify-center items-center min-h-screen pb-64'>
      <Card className='max-w-md mx-auto text-center shadow-lg'>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            ¡Gracias por su compra!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>
            Ya podés descargar tus entradas. También fueron enviadas a el/los
            email/s que proporcionaste.
          </p>
        </CardContent>
        <CardFooter className='justify-center'>
          <Button onClick={() => downloadAllPdfs()}>
            <Download className='mr-2 h-4 w-4' />
            Descargar Entradas
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
