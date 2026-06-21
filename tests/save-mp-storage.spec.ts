import 'dotenv/config';

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import test from '@playwright/test';

const storagePath =
  process.env.MP_STORAGE_STATE ?? 'playwright/.auth/mp-user.json';

test.use({ bypassCSP: true });
test.setTimeout(0);

test('guardar sesión de Mercado Pago', async ({ page, context }) => {
  await page.goto('https://www.mercadopago.com.ar');
  console.log(
    '\n1. Iniciá sesión manualmente en el browser\n' +
      '2. Cuando veas tu cuenta logueada, reanudá el test en el inspector de Playwright\n' +
      `3. Se guardará la sesión en ${storagePath}\n`,
  );
  await page.pause();
  mkdirSync(dirname(storagePath), { recursive: true });
  await context.storageState({ path: storagePath });
  console.log(`Sesión guardada en ${storagePath}`);
});
