// Después de todos los tests: lo que no se ve en pantalla. Pagos sin entradas,
// sobreventa, escaneos dobles, compras sin mail y errores del servidor durante
// toda la corrida (tests/stack/check.mjs). Sólo cuenta lo nuevo: lo que ya
// estaba antes de empezar queda en la línea de base que anota la preparación.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { STACK } from '@tests/stack/browser-env.mjs';

import { baselineFile, startFile } from '@tests/e2e/support/stack';

type Finding = {
  severity: string;
  check: string;
  tenant: string;
  detail: string;
  rows: unknown[];
};

const rowsOf = (findings: Finding[]) =>
  new Set(
    findings.flatMap((f) =>
      f.rows.map((row) => `${f.check}|${f.tenant}|${JSON.stringify(row)}`),
    ),
  );

test('sin pagos perdidos, sobreventa ni errores del servidor', async ({}, testInfo) => {
  test.skip(!existsSync(startFile), 'no corrió la preparación');
  const since = readFileSync(startFile, 'utf8').trim();
  const output = execFileSync(
    process.execPath,
    [path.join(STACK, 'check.mjs'), '--since', since, '--json', '--all-rows'],
    {
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 20_000_000,
    },
  );
  const { findings } = JSON.parse(output) as { findings: Finding[] };
  const before = existsSync(baselineFile)
    ? rowsOf(
        (
          JSON.parse(readFileSync(baselineFile, 'utf8')) as {
            findings: Finding[];
          }
        ).findings,
      )
    : new Set<string>();
  const fresh = findings
    .filter((f) => f.severity !== 'baja')
    .map((f) => ({
      ...f,
      rows: f.rows.filter(
        (row) => !before.has(`${f.check}|${f.tenant}|${JSON.stringify(row)}`),
      ),
    }))
    .filter((f) => f.rows.length);
  await testInfo.attach('chequeo.json', {
    body: JSON.stringify(findings, null, 2),
    contentType: 'application/json',
  });
  expect(
    fresh.map(
      (f) =>
        `[${f.severity}] ${f.check} (${f.tenant}): ${f.detail}\n    ${JSON.stringify(f.rows[0]).slice(0, 600)}`,
    ),
  ).toEqual([]);
});
