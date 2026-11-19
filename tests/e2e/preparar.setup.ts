import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { STACK } from '@tests/stack/browser-env.mjs';

import { baselineFile, seed, startFile } from '@tests/e2e/support/stack';

test('el stack responde', async ({ request }) => {
  const next = await request.get(
    `http://127.0.0.1:${process.env.STACK_NEXT_PORT}/`,
    {
      headers: { 'x-forwarded-host': 'prueba.pn.test' },
    },
  );
  expect(next.status(), 'Next no responde: tests/stack/up.sh').toBeLessThan(
    500,
  );
  const mocks = await request.get(
    `${process.env.STACK_MOCKS_URL}/api/mails?to=nadie`,
    {
      headers: { 'x-stack-original-host': 'mail.mock.test' },
    },
  );
  expect(
    mocks.ok(),
    'Los servicios simulados no responden: tests/stack/up.sh',
  ).toBeTruthy();
  expect(
    seed().tenants.prueba.events.length,
    'Falta sembrar: tests/stack/up.sh --reseed',
  ).toBeGreaterThan(0);

  // Lo que el chequeo ya encuentra antes de empezar (restos de corridas
  // anteriores o del enjambre) no se le cobra a esta corrida.
  const now = new Date().toISOString();
  const output = execFileSync(
    process.execPath,
    [path.join(STACK, 'check.mjs'), '--since', now, '--json', '--all-rows'],
    {
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 20_000_000,
    },
  );
  writeFileSync(baselineFile, output);
  writeFileSync(startFile, now);
});
