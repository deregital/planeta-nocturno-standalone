import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import fs from 'fs';
import path from 'path';

import fontkit from '@pdf-lib/fontkit';
import { inArray, min, sql } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { type Fontkit } from 'pdf-lib/cjs/types/fontkit';

import { type db as database } from '@/drizzle';

import { emittedTicket } from '@/drizzle/schema';

export async function getDMSansFonts(): Promise<{
  fontBold: Buffer<ArrayBufferLike>;
  fontSemiBold: Buffer<ArrayBufferLike>;
  fontLight: Buffer<ArrayBufferLike>;
  fontSymbols: Buffer<ArrayBufferLike>;
}> {
  const fontFolderPath = path.join(process.cwd(), 'public', 'fonts');

  const fontBoldPath = path.join(fontFolderPath, 'DMSans-Bold.ttf');
  const fontBold = await fs.promises.readFile(fontBoldPath);

  const fontSemiBoldPath = path.join(fontFolderPath, 'DMSans-SemiBold.ttf');
  const fontSemiBold = await fs.promises.readFile(fontSemiBoldPath);

  const fontLightPath = path.join(fontFolderPath, 'DMSans-Light.ttf');
  const fontLight = await fs.promises.readFile(fontLightPath);

  const fontSymbolsPath = path.join(fontFolderPath, 'Symbols.ttf');
  const fontSymbols = await fs.promises.readFile(fontSymbolsPath);

  return { fontBold, fontSemiBold, fontLight, fontSymbols };
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ /g, '-');
}

function getKeyFromSecret(secret: string): Buffer {
  // Convierte un string cualquiera en una clave de 32 bytes mediante hash SHA-256
  return createHash('sha256').update(secret).digest();
}

export function encryptString(string: string): string {
  const key = getKeyFromSecret(process.env.BARCODE_SECRET!);
  const iv = randomBytes(16); // 16 bytes para AES-256-CBC
  const cipher = createCipheriv('aes-256-cbc', key, iv);

  // Codifica en Base64 en lugar de hex
  let encrypted = cipher.update(string, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // IV también en Base64
  const ivBase64 = iv.toString('base64');

  // Retorna IV + texto cifrado (separados por :)
  const result = ivBase64 + ':' + encrypted;
  return result;
}

export function decryptString(encryptedString: string): string {
  try {
    const [ivBase64, cipherTextBase64] = encryptedString.split(':');
    if (!ivBase64 || !cipherTextBase64) {
      throw new Error('Cadena inválida');
    }
    const key = getKeyFromSecret(process.env.BARCODE_SECRET!);
    const iv = Buffer.from(ivBase64!, 'base64');

    let ticketId: string;
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    ticketId = decipher.update(cipherTextBase64!, 'base64', 'utf8');
    ticketId += decipher.final('utf8');

    return ticketId;
  } catch (error) {
    throw error;
  }
}

export async function measureTextWidth(
  text: string,
  fontBytes: Buffer<ArrayBufferLike>,
  fontSize: number,
): Promise<number> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit as unknown as Fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  return font.widthOfTextAtSize(text, fontSize);
}

export function truncateText(text: string, maxLength: number = 25): string {
  if (text.length <= maxLength) {
    return text;
  }

  const ellipsis = '...';
  // Dejar espacio para los puntos suspensivos
  const truncatedLength = maxLength - ellipsis.length;

  if (truncatedLength <= 0) {
    return ellipsis;
  }

  return text.substring(0, truncatedLength) + ellipsis;
}

/**
 * Calcula el final del día en UTC (23:59:59.999) para una fecha dada.
 * Esta función mantiene el mismo día en UTC.
 */
export function endOfDayUTC(date: Date): Date {
  const utcDate = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return utcDate;
}

export async function getBuyersCodeByDni(
  db: typeof database,
  dnis: string[],
): Promise<{ dni: string; id: number }[] | null> {
  if (dnis.length === 0) return null;

  const firstPurchaseDate = min(emittedTicket.createdAt).as('firstPurchase');

  const allBuyersCte = db
    .select({
      dni: emittedTicket.dni,
      firstPurchase: firstPurchaseDate,
    })
    .from(emittedTicket)
    .groupBy(emittedTicket.dni)
    .as('all_buyers');

  // Agarramos los DNIs pasados y le asignamos un ID global
  const filteredBuyers = await db
    .with(allBuyersCte) // Indica a Drizzle que use la CTE
    .select({
      dni: allBuyersCte.dni,
      id: sql<number>`ROW_NUMBER() OVER (ORDER BY ${allBuyersCte.firstPurchase} ASC)`.as(
        'id',
      ),
    })
    .from(allBuyersCte)
    .where(inArray(allBuyersCte.dni, dnis)); // Filtro los DNIs pasados

  return filteredBuyers;
}
