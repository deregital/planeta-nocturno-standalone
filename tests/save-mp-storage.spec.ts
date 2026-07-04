/**
 * Guarda el estado de sesión de MercadoPago para evitar el OTP en tests futuros.
 *
 * Ejecutar UNA SOLA VEZ en modo headed para loguearse manualmente:
 *
 *   npx playwright test save-mp-storage --headed --project=chromium
 *
 * El test abre el checkout de MP y hace PAUSA para que vos:
 *   1. Inicies sesión con la cuenta de prueba compradora
 *   2. Llegues al paso "¿Cómo querés pagar?" (sin completar el pago)
 *   3. Presiones el botón ▶ (Resume) en la UI de Playwright
 *
 * La sesión queda guardada en playwright/.auth/mp-user.json.
 * Luego agregá en .env:
 *   MP_STORAGE_STATE=playwright/.auth/mp-user.json
 *
 * Con eso los tests de checkout no pedirán OTP en futuras corridas.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

import test, { expect } from '@playwright/test';

import {
  findFirstEventWithPaidTicket,
  paidTicketTestUse,
} from './helpers/paid-ticket-flow';

test.use({
  ...paidTicketTestUse,
  // No usar storageState guardado para este test (queremos loguear desde cero)
  storageState: undefined,
});
test.setTimeout(300_000); // 5 minutos para que el usuario complete el login manual

const STORAGE_PATH = path.join(
  process.cwd(),
  'playwright',
  '.auth',
  'mp-user.json',
);

test('save-mp-storage', async ({ page }) => {
  // 1. Ir a un evento pago para gatillar el checkout y generar una preferencia real
  const event = await findFirstEventWithPaidTicket(page);
  await page.goto(`/event/${event.slug}`);

  const ticketRow = page
    .locator('.flex.flex-col.gap-2')
    .filter({ hasText: event.ticketName })
    .filter({ hasText: /\$\s*[\d.]+/ })
    .filter({ hasNotText: 'GRATUITO' });

  await expect(ticketRow).toBeVisible({ timeout: 10_000 });
  await ticketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  // 2. Rellenar datos del comprador con un email único
  await expect(page).toHaveURL(/\/checkout/, { timeout: 15_000 });
  await page.getByLabel('Nombre y apellido').fill('Save MP Session');
  await page
    .getByLabel('Mail')
    .fill(`save-mp-session-${Date.now()}@example.com`);
  await page.getByLabel('DNI/Pasaporte').fill('99999999');

  const phoneInput = page.locator('input[type="tel"]');
  await phoneInput.click();
  await phoneInput.pressSequentially('1140001234', { delay: 50 });
  await phoneInput.blur();

  await page.getByLabel('Fecha de nacimiento').fill('1990-01-01');
  await page
    .getByRole('combobox')
    .filter({ hasText: 'Selecciona tu género' })
    .click();
  await page.getByRole('option', { name: 'Masculino' }).click();

  const comprarButton = page.getByRole('button', { name: 'COMPRAR' });
  await expect(comprarButton).toBeEnabled();
  await comprarButton.click();

  // 3. Esperar redirect a /tickets/ y luego a mercadopago.com
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}/i, {
    timeout: 60_000,
    waitUntil: 'commit',
  });

  await page.waitForURL(/mercadopago\.com/i, { timeout: 45_000 });

  // 4. PAUSA — el usuario inicia sesión manualmente con la cuenta compradora de prueba.
  //    Credenciales en: panel MP → tu app → Test accounts
  //    Llegar hasta "¿Cómo querés pagar?" sin completar el pago.
  //    Luego presionar ▶ (Resume) en la UI de Playwright.
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  ACCIÓN REQUERIDA EN EL BROWSER:');
  console.log('  1. Iniciá sesión con la cuenta de prueba compradora de MP');
  console.log(
    '     Usuario: ' + (process.env.MP_CHECKOUT_USER ?? '(ver panel MP)'),
  );
  console.log('     Contraseña y código: ver panel MP → Test accounts');
  console.log('  2. Llegá al paso "¿Cómo querés pagar?"');
  console.log('  3. Presioná ▶ (Resume) en la UI de Playwright');
  console.log('══════════════════════════════════════════════════════════\n');

  await page.pause();

  // 5. Guardar el estado de sesión
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await page.context().storageState({ path: STORAGE_PATH });

  console.log(`\n✅ Sesión guardada en: ${STORAGE_PATH}`);
  console.log('   Agregá en .env:');
  console.log(`   MP_STORAGE_STATE=${STORAGE_PATH}\n`);

  // Verificar que el archivo se creó
  expect(fs.existsSync(STORAGE_PATH)).toBe(true);
  const saved = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));
  expect(saved.cookies?.length ?? 0).toBeGreaterThan(0);
});
