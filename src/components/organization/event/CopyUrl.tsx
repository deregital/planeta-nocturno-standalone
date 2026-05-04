'use client';

import { Link, Loader2, Printer } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

function wrapTitleLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    flush();
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      const test = chunk + ch;
      if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
        chunk = test;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  flush();
  return lines.length ? lines : [''];
}

async function generateOrganizerLinkPdf(url: string, eventName: string) {
  const dataUrl = await QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('No se pudo generar el código QR');
  }
  const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const maxTitleWidth = width - 72;
  let fontSize = 22;
  let lines = wrapTitleLines(eventName, maxTitleWidth, fontSize, font);
  while (lines.length > 5 && fontSize > 12) {
    fontSize -= 1;
    lines = wrapTitleLines(eventName, maxTitleWidth, fontSize, font);
  }

  const lineHeight = fontSize * 1.25;
  let cursorY = height - 72;
  for (const line of lines) {
    const tw = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: (width - tw) / 2,
      y: cursorY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    cursorY -= lineHeight;
  }

  const qrImage = await pdfDoc.embedPng(pngBytes);
  const qrSize = Math.min(320, cursorY - 72);
  const qrX = (width - qrSize) / 2;
  const qrY = cursorY - 32 - qrSize;
  page.drawImage(qrImage, {
    x: qrX,
    y: Math.max(72, qrY),
    width: qrSize,
    height: qrSize,
  });

  return pdfDoc.save();
}

function printPdfBytes(pdfBytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(pdfBytes)], {
    type: 'application/pdf',
  });
  const objectUrl = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.src = objectUrl;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      iframe.remove();
    }, 2_000);
  };
}

export function CopyUrl({
  url,
  eventName,
}: {
  url: string;
  eventName: string;
}) {
  const [printing, setPrinting] = useState(false);

  function copyToClipboard() {
    void navigator.clipboard.writeText(url);
    toast.success('URL copiada al portapapeles');
  }

  async function printQrPdf() {
    setPrinting(true);
    try {
      const pdfBytes = await generateOrganizerLinkPdf(url, eventName);
      printPdfBytes(pdfBytes);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo generar el PDF para imprimir');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className='flex flex-wrap items-center justify-center gap-3'>
      <Button
        type='button'
        variant='accent'
        className='w-fit'
        onClick={copyToClipboard}
      >
        <Link className='h-4 w-4' />
        Copiar mi ticket
      </Button>
      <Button
        type='button'
        variant='outline'
        className='w-fit'
        disabled={printing}
        onClick={() => void printQrPdf()}
      >
        {printing ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <Printer className='h-4 w-4' />
        )}
      </Button>
    </div>
  );
}
