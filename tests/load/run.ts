import '@tests/load/bootstrap';

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// El orden por defecto; cualquier otro archivo de scenarios/ corre después.
const DEFAULT_ORDER = [
  'public-page',
  'purchase',
  'invitation',
  'redistribution',
  'scan',
  'backoffice',
];

function rank(name: string) {
  const index = DEFAULT_ORDER.indexOf(name);
  return index === -1 ? DEFAULT_ORDER.length : index;
}

async function main() {
  const available = (await readdir(path.join(__dirname, 'scenarios')))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.replace(/\.ts$/, ''))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const requested = process.argv.slice(2);
  const names = requested.length > 0 ? requested : available;
  const unknown = names.filter((n) => !available.includes(n));
  if (unknown.length > 0) {
    throw new Error(
      `Escenarios desconocidos: ${unknown.join(', ')}. Disponibles: ${available.join(', ')}`,
    );
  }

  const outDir =
    process.env.LOAD_RESULTS_DIR ?? path.join(__dirname, 'results');
  await mkdir(outDir, { recursive: true });

  for (const name of names) {
    console.log(`\n=== ${name} ===`);
    const scenario = (await import(`./scenarios/${name}`)) as {
      default: (log: (...args: unknown[]) => void) => Promise<unknown>;
    };
    const startedAt = Date.now();
    const result = await scenario.default((...args) =>
      console.log(`[${name}]`, ...args),
    );
    const file = path.join(outDir, `${name}.json`);
    await writeFile(
      file,
      JSON.stringify(
        { scenario: name, durationMs: Date.now() - startedAt, result },
        null,
        2,
      ),
    );
    console.log(`[${name}] resultados en ${file}`);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exit(1);
  },
);
