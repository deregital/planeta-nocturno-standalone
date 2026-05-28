import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';

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

export async function generateEventLinkPdf(url: string, eventName: string) {
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

function isMobileDevice() {
  if (typeof window === 'undefined') return false;

  const mobileUserAgent = /android|iphone|ipad|ipod|mobile/i.test(
    navigator.userAgent,
  );
  return window.matchMedia('(max-width: 768px)').matches || mobileUserAgent;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w\s-]/g, '').trim() || 'evento-qr';
}

export type PrintPdfResult = 'printed' | 'opened' | 'shared';

export async function printPdfBytes(
  pdfBytes: Uint8Array,
  options?: { filename?: string; title?: string },
): Promise<PrintPdfResult> {
  const blob = new Blob([new Uint8Array(pdfBytes)], {
    type: 'application/pdf',
  });
  const filename = `${sanitizeFilename(options?.filename ?? options?.title ?? 'evento-qr')}.pdf`;

  if (isMobileDevice()) {
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: options?.title,
        });
        return 'shared';
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return 'shared';
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return 'opened';
  }

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

  return 'printed';
}
