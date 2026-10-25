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

// tsx resuelve `require('../metadata.min.json')` de libphonenumber-js al wrapper
// ESM `metadata.min.json.js` y la validación de teléfonos falla. Se fija el JSON.
const phoneMetadataDir = require('node:path').dirname(
  require.resolve('libphonenumber-js/package.json'),
);
const phoneMetadata = JSON.parse(
  require('node:fs').readFileSync(
    `${phoneMetadataDir}/metadata.min.json`,
    'utf8',
  ),
);
for (const file of ['metadata.min.json', 'metadata.min.json.js']) {
  const filename = `${phoneMetadataDir}/${file}`;
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports: phoneMetadata,
  } as NodeJS.Module;
}

// Algunos módulos del servidor importan componentes .tsx (runtime JSX clásico).
(globalThis as Record<string, unknown>).React = require('react');

// El logger de la app vuelca errores enormes (ej.: los 10.000 parámetros de un
// INSERT fallido). Los escenarios ya registran los errores que les importan.
if (!process.env.LOAD_VERBOSE) {
  console.error = () => {};
  console.warn = () => {};
}
