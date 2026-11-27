// Tests e2e contra el stack simulado (tests/stack): la app real con todo lo
// externo simulado. Con el stack levantado (tests/stack/up.sh):
//   npm run test:e2e                 # golden path + chequeo final
//   npm run test:e2e -- --ui         # para mirarlos paso a paso
import { defineConfig } from '@playwright/test';
import { chromiumArgs } from '@tests/stack/browser-env.mjs';

import { loadStackEnv } from '@tests/e2e/support/stack';

loadStackEnv();

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../test-results/e2e-report', open: 'never' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: { args: chromiumArgs() },
  },
  projects: [
    // Anota la hora de arranque y verifica que el stack responda.
    { name: 'preparar', testMatch: /preparar\.setup\.ts/, teardown: 'chequeo' },
    {
      name: 'golden',
      testMatch: /golden\/.*\.spec\.ts/,
      dependencies: ['preparar'],
    },
    // Corre al final: invariantes de las bases, pagos contra mails y errores
    // del servidor de toda la corrida (tests/stack/check.mjs).
    { name: 'chequeo', testMatch: /chequeo\.teardown\.ts/ },
  ],
});
