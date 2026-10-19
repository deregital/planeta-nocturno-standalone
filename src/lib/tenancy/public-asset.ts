import { statSync } from 'node:fs';
import path from 'node:path';

const PUBLIC_ASSET_EXTENSION =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$/i;

export type PublicAssetMatch = 'file' | 'missing' | 'none';

/**
 * Dice si el pathname es un archivo de `public/`. Las rutas de la app (sin
 * esa extensión) devuelven `none` para que las resuelva el ruteo de tenants.
 */
export function classifyPublicAsset(
  pathname: string,
  publicDirectory = path.join(process.cwd(), 'public'),
): PublicAssetMatch {
  if (
    !pathname.startsWith('/') ||
    pathname.includes('\\') ||
    pathname.includes('\0') ||
    !PUBLIC_ASSET_EXTENSION.test(pathname)
  ) {
    return 'none';
  }

  const publicRoot = path.resolve(publicDirectory);
  const filePath = path.resolve(publicRoot, `.${pathname}`);
  const insidePublic =
    filePath === publicRoot || filePath.startsWith(`${publicRoot}${path.sep}`);
  if (!insidePublic || !PUBLIC_ASSET_EXTENSION.test(filePath)) return 'missing';

  try {
    return statSync(filePath).isFile() ? 'file' : 'missing';
  } catch {
    return 'missing';
  }
}
