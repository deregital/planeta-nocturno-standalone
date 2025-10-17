import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import fs from 'fs';
import path from 'path';

import fontkit from '@pdf-lib/fontkit';
import { compareAsc } from 'date-fns';
import { asc } from 'drizzle-orm';
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

export async function getBuyersCodeByDni(
  db: typeof database,
  dnis: string[],
): Promise<Record<string, string> | null> {
  if (dnis.length === 0) return null;

  // Obtener el primer ticket emitido para TODOS los DNIs únicos en la base de datos (no solo los que se están consultando)
  const allFirstTicketsByDni = await db
    .selectDistinctOn([emittedTicket.dni], {
      dni: emittedTicket.dni,
      createdAt: emittedTicket.createdAt,
    })
    .from(emittedTicket)
    .orderBy(emittedTicket.dni, asc(emittedTicket.createdAt));

  // Ordenar por fecha de creación para asignar códigos incrementales globales
  const sortedAllTickets = allFirstTicketsByDni.sort((a, b) =>
    compareAsc(new Date(a.createdAt), new Date(b.createdAt)),
  );

  // Crear mapa global de códigos para TODOS los DNIs únicos
  const globalBuyerCodes: Record<string, string> = {};
  sortedAllTickets.forEach((ticket, index) => {
    globalBuyerCodes[ticket.dni] = (index + 1).toString();
  });

  // Retornar solo los códigos para los DNIs solicitados
  const requestedBuyerCodes: Record<string, string> = {};
  dnis.forEach((dni) => {
    requestedBuyerCodes[dni] = globalBuyerCodes[dni] || '---';
  });

  return requestedBuyerCodes;
}
