import test, { expect } from '@playwright/test';

const BASE_URL = 'https://localhost:3000';
const FREE_EVENT_SLUG = 'fiesta-de-bienvenida';

test.use({ ignoreHTTPSErrors: true });

test.setTimeout(60_000);

test('compra un ticket free', async ({ page }) => {
  const uniqueId = Date.now().toString().slice(-8);
  const buyer = {
    fullName: 'Test Playwright',
    mail: `test-${uniqueId}@example.com`,
    dni: `40${uniqueId}`,
    phone: '91140000999',
    birthDate: '2000-05-15',
  };

  await page.goto(`${BASE_URL}/event/${FREE_EVENT_SLUG}`);

  await expect(page.getByText('Entrada General')).toBeVisible();
  await expect(page.getByText('GRATUITO').first()).toBeVisible();

  const freeTicketRow = page
    .locator('.flex.flex-col.gap-2')
    .filter({ hasText: 'Entrada General' });
  await freeTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();

  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText('Fiesta de Bienvenida')).toBeVisible();

  await page.getByLabel('Nombre y apellido').fill(buyer.fullName);
  await page.getByLabel('Mail').fill(buyer.mail);
  await page.getByLabel('DNI/Pasaporte').fill(buyer.dni);

  const phoneInput = page.locator('input[type="tel"]');
  await phoneInput.click();
  await phoneInput.pressSequentially(buyer.phone, { delay: 50 });
  await phoneInput.blur();

  await page.getByLabel('Fecha de nacimiento').fill(buyer.birthDate);

  await page
    .getByRole('combobox')
    .filter({ hasText: 'Selecciona tu género' })
    .click();
  await page.getByRole('option', { name: 'Masculino' }).click();

  await page
    .getByLabel('¿Cómo te enteraste del evento?')
    .fill('Playwright test');
  await page
    .getByLabel('¿Tenés alguna restricción alimentaria?')
    .fill('Ninguna');

  await page.getByRole('button', { name: 'ADQUIRIR' }).click();

  await expect(page).toHaveURL(/\/tickets\//, { timeout: 30_000 });
  await expect(page.getByText('¡Gracias por su compra!')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar Tickets' }),
  ).toBeVisible();
});
