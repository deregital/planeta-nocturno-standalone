'use client';

import { type RouterOutputs } from '@/server/routers/app';

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
    <div>
      <button onClick={() => downloadAllPdfs()}>Descargar PDF</button>
    </div>
  );
}
