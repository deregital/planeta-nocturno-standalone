'use client';

import { trpc } from '@/server/trpc/client';
import { use } from 'react';

interface PaymentPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function Page({ params }: PaymentPageProps) {
  const { slug } = use(params);
  // traer pdf segun el paymentId
  const { data: pdfs, isLoading } =
    trpc.ticketGroup.generatePdfsByTicketGroupId.useQuery(slug);

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
    console.log(pdfs);
    if (pdfs && pdfs.length > 0) {
      console.log('ENTOR');
      pdfs.forEach(async (pdf) => {
        const pdfBase64 = Buffer.from(await pdf.pdf.arrayBuffer()).toString(
          'base64',
        );

        downloadPdf(pdfBase64, 'prueba');
      });
    }
  };

  return !pdfs || isLoading ? (
    <p>Cargndo</p>
  ) : (
    <div>
      <p>{pdfs ? 'HAY PDfS' : 'NO HAY PDFS'}</p>
      <p>{slug} success</p>
      <button onClick={() => downloadAllPdfs()}>Descargar PDF</button>
    </div>
  );
}
