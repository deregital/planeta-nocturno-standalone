import { createCipheriv, createHash, randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

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
  return ivBase64 + ':' + encrypted;
}
