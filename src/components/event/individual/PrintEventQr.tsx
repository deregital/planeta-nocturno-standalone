'use client';

import { Loader2, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { generateEventLinkPdf, printPdfBytes } from '@/lib/event-qr-pdf';
import { cn } from '@/lib/utils';

export function PrintEventQr({
  url,
  eventName,
  className,
  variant = 'outline',
  showLabel = true,
}: {
  url: string;
  eventName: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  showLabel?: boolean;
}) {
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!url) {
      toast.error('No se pudo obtener la URL del evento');
      return;
    }

    setPrinting(true);
    try {
      const pdfBytes = await generateEventLinkPdf(url, eventName);
      printPdfBytes(pdfBytes);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF para imprimir');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Button
      type='button'
      variant={variant}
      className={cn(showLabel && 'flex gap-x-5 w-full', 'w-fit', className)}
      disabled={printing || !url}
      onClick={() => void handlePrint()}
      aria-label='Imprimir código QR del evento'
    >
      {showLabel && 'Imprimir QR'}
      {printing ? (
        <Loader2 className='size-5 animate-spin' />
      ) : (
        <Printer className='size-5' />
      )}
    </Button>
  );
}
