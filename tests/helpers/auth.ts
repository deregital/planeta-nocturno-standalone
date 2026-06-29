import { expect, type Page } from '@playwright/test';

export function getAdminCredentials() {
  const username = process.env.TEST_SEED_USER_NAME;
  const password = process.env.TEST_SEED_USER_PASSWORD;

  if (!username) {
    throw new Error('TEST_SEED_USER_NAME is not set');
  }
  if (!password) {
    throw new Error('TEST_SEED_USER_PASSWORD is not set');
  }

  return { username, password };
}

export async function loginAsAdmin(page: Page) {
  const { username, password } = getAdminCredentials();

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Nombre de usuario' }).fill(username);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).not.toHaveURL(/\/login/);
}

export async function loginAsUser(
  page: Page,
  credentials: { username: string; password: string },
) {
  await page.goto('/login');
  await page
    .getByRole('textbox', { name: 'Nombre de usuario' })
    .fill(credentials.username);
  await page
    .getByRole('textbox', { name: 'Contraseña' })
    .fill(credentials.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(page).not.toHaveURL(/\/login/);
}
