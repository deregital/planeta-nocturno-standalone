import fs from 'fs';
import path from 'path';

export async function getDMSansFonts(): Promise<{
  fontBold: Buffer<ArrayBufferLike>;
  fontSemiBold: Buffer<ArrayBufferLike>;
  fontLight: Buffer<ArrayBufferLike>;
}> {
  const fontFolderPath = path.join(process.cwd(), 'public', 'fonts');

  const fontBoldPath = path.join(fontFolderPath, 'DMSans-Bold.ttf');
  const fontBold = await fs.promises.readFile(fontBoldPath);

  const fontSemiBoldPath = path.join(fontFolderPath, 'DMSans-SemiBold.ttf');
  const fontSemiBold = await fs.promises.readFile(fontSemiBoldPath);

  const fontLightPath = path.join(fontFolderPath, 'DMSans-Light.ttf');
  const fontLight = await fs.promises.readFile(fontLightPath);

  return { fontBold, fontSemiBold, fontLight };
}
