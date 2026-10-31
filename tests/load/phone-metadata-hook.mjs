import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * tsx envuelve `export default` de metadata.min.json.js y libphonenumber
 * recibe `{ default }` en vez del metadata. Este hook devuelve el JSON crudo.
 */
export async function load(url, context, nextLoad) {
  if (!url.includes('libphonenumber-js/metadata.min.json')) {
    return nextLoad(url, context);
  }

  let filePath = fileURLToPath(url.split('?')[0]);
  if (filePath.endsWith('.js')) filePath = filePath.slice(0, -3);
  const json = readFileSync(filePath, 'utf8');
  return {
    format: 'module',
    source: `export default ${json}\n`,
    shortCircuit: true,
  };
}
