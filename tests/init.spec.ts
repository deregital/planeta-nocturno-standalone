import 'dotenv/config';

import test, { expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  const username = process.env.SEED_USER_NAME ?? 'admin';
  const password = process.env.SEED_USER_PASSWORD ?? '123456';

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Nombre de usuario' }).fill(username);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).not.toHaveURL(/\/login/);
}

test('login', async ({ page }) => {
  await loginAsAdmin(page);
});

test.describe('admin autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('create event', async ({ page }) => {
    await page.goto('/admin/event/create');
    await expect(
      page.getByRole('heading', { name: 'Crear evento' }),
    ).toBeVisible();
  });
});
