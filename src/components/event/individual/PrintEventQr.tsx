'use client';

import { Check, Copy, Loader2, Printer, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    setLoadingQr(true);
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          toast.error('No se pudo generar el código QR');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQr(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  async function handleCopy() {
    if (!qrDataUrl) return;
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      toast.error('Tu navegador no permite copiar imágenes');
      return;
    }
    try {
      // A ClipboardItem se le pasa la promesa (no el blob ya resuelto) para
      // que Safari no pierda el gesto del usuario mientras se arma la imagen.
      const blob = fetch(qrDataUrl).then((r) => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      toast.success('QR copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo copiar el QR');
    }
  }

  async function handlePrint() {
    if (!url) {
      toast.error('No se pudo obtener la URL del evento');
      return;
    }

    setPrinting(true);
    try {
      const pdfBytes = await generateEventLinkPdf(url, eventName);
      const result = await printPdfBytes(pdfBytes, {
        title: eventName,
        filename: eventName,
      });
      if (result === 'opened') {
        toast.info(
          'Se abrió el PDF. Usá compartir o imprimir desde el menú del navegador.',
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF para imprimir');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant={variant}
          className={cn(showLabel && 'flex gap-x-5 w-full', 'w-fit', className)}
          disabled={!url}
          aria-label='Ver código QR del evento'
        >
          {showLabel && 'Código QR'}
          <QrCode className='size-5' />
        </Button>
      </DialogTrigger>
      <DialogContent
        className='sm:max-w-md'
        overlayClassName='bg-black/55 backdrop-blur-3xl'
      >
        <DialogHeader>
          <DialogTitle>{eventName}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col items-center gap-4 py-2'>
          {loadingQr ? (
            <Loader2 className='size-12 animate-spin text-muted-foreground' />
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Código QR de ${eventName}`}
              className='size-64 max-w-full rounded-md border'
            />
          ) : (
            <p className='text-sm text-muted-foreground'>
              No se pudo cargar el código QR
            </p>
          )}
          <p className='w-full break-all text-center text-xs text-muted-foreground'>
            {url}
          </p>
        </div>
        <DialogFooter className='flex-wrap gap-2'>
          <Button
            type='button'
            variant='ghost'
            disabled={printing || !url}
            onClick={() => void handlePrint()}
          >
            {printing ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Printer className='size-4' />
            )}
            Imprimir
          </Button>
          <Button
            type='button'
            disabled={!qrDataUrl}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <Check className='size-4' />
            ) : (
              <Copy className='size-4' />
            )}
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
