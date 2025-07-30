'use client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type RouterOutputs } from '@/server/routers/app';

interface BuyTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfs?: RouterOutputs['ticketGroup']['getPdf']['pdfs'];
}

function BuyTicketsModal({ isOpen, onClose, pdfs }: BuyTicketsModalProps) {
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
      pdfs.forEach((pdf) => {
        downloadPdf(pdf.pdfBase64, pdf.ticketId);
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <VisuallyHidden asChild>
        <DialogTitle>Compra de entradas</DialogTitle>
      </VisuallyHidden>
      <DialogContent className='bg-[#F9F9F9] rounded-[20px] p-8 max-w-md mx-auto text-center border-none'>
        {/* Ícono de check */}
        <div className='flex justify-center mb-8'>
          <div className='w-24 h-24 rounded-full border-4 border-black flex items-center justify-center'>
            <Check className='w-12 h-12 text-black stroke-[3]' />
          </div>
        </div>

        {/* Mensaje de éxito */}
        <h2 className='text-2xl font-bold text-black mb-2'>
          Compra realizada con éxito.
        </h2>

        {/* Instrucciones */}
        <p className='text-lg text-black mb-4'>
          Podés visualizar tu entrada en tu mail o descargarla clickeando abajo
        </p>

        {pdfs && pdfs.length > 0 && (
          <div className='mt-6 space-y-4'>
            <h3 className='text-lg font-semibold text-black'>
              Descarga de Tickets
            </h3>

            {pdfs.length > 1 ? (
              <>
                <div className='grid grid-cols-1 gap-2'>
                  {pdfs.map((pdf, index) => (
                    <Button
                      key={pdf.ticketId}
                      onClick={() => downloadPdf(pdf.pdfBase64, pdf.ticketId)}
                      className='cursor-pointer flex items-center justify-center gap-2 bg-MiExpo_purple hover:bg-MiExpo_purple/90 text-white'
                    >
                      <Download className='w-4 h-4' />
                      <span>Descargar Ticket {index + 1}</span>
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={downloadAllPdfs}
                  className='cursor-pointer w-full flex items-center justify-center gap-2 bg-black hover:bg-black/80 text-white mt-2'
                >
                  <Download className='w-4 h-4' />
                  <span>Descargar Todos los Tickets</span>
                </Button>
              </>
            ) : (
              <Button
                onClick={() => downloadPdf(pdfs[0].pdfBase64, pdfs[0].ticketId)}
                className='cursor-pointer w-full flex items-center justify-center gap-2 bg-MiExpo_purple hover:bg-MiExpo_purple/90 text-white'
              >
                <Download className='w-4 h-4' />
                <span>Descargar Ticket</span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BuyTicketsModal;
