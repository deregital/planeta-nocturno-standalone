/**
 * Prepara el proceso para importar los routers reales fuera de Next.js.
 * Tiene que ser el primer import de cada script de carga.
 */
process.env.RESEND_API_KEY ??= 're_load_test_dummy';
process.env.BARCODE_SECRET ??= 'load-test-barcode-secret';
process.env.AUTH_SECRET ??= 'load-test-auth-secret';

// `server-only` lanza fuera de un React Server Component.
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeJS.Module;

// tsx resuelve `require('../metadata.min.json')` al wrapper ESM
// `metadata.min.json.js` y el require devuelve `{ default }`. La validación
// de teléfonos necesita el objeto con `.countries`.
const Module = require('node:module');
const phoneMetadataPath = require('node:path').join(
  require('node:path').dirname(
    require.resolve('libphonenumber-js/package.json'),
  ),
  'metadata.min.json',
);
const phoneMetadata = JSON.parse(
  require('node:fs').readFileSync(phoneMetadataPath, 'utf8'),
);
const originalLoad = Module._load;
Module._load = function loadPhoneMetadata(
  this: NodeJS.Module,
  request: string,
  parent: NodeJS.Module,
  isMain: boolean,
) {
  if (request.includes('metadata.min.json')) return phoneMetadata;
  return originalLoad.call(this, request, parent, isMain);
};

// Algunos módulos del servidor importan componentes .tsx (runtime JSX clásico).
(globalThis as Record<string, unknown>).React = require('react');

// El logger de la app vuelca errores enormes (ej.: los 10.000 parámetros de un
// INSERT fallido). Los escenarios ya registran los errores que les importan.
if (!process.env.LOAD_VERBOSE) {
  console.error = () => {};
  console.warn = () => {};
}
