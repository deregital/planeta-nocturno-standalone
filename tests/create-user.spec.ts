import 'dotenv/config';

import test, { expect } from '@playwright/test';

import { getAdminCredentials, loginAsAdmin, loginAsUser } from './helpers/auth';

test.use({ baseURL: process.env.TEST_BASE_URL });

test.setTimeout(60_000);

type CreatedUser = {
  fullName: string;
  username: string;
  password: string;
};

let createdUser: CreatedUser | null = null;

test.describe.serial('admin autenticado', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('create user', async ({ page }) => {
    const uniqueId = Date.now().toString().slice(-8);
    const newUser = {
      fullName: `Usuario Test ${uniqueId}`,
      email: `test-user-${uniqueId}@example.com`,
      username: `testuser${uniqueId}`,
      password: getAdminCredentials().password,
      dni: `40${uniqueId}`,
      birthDate: '2000-05-15',
    };

    await page.goto('/admin/settings');

    await expect(
      page.getByRole('button', { name: /Nuevo usuario/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Nuevo usuario/i }).click();

    const createDialog = page.getByRole('dialog', { name: 'Crear usuario' });
    await expect(createDialog).toBeVisible();

    await createDialog
      .getByRole('textbox', { name: 'Nombre *' })
      .fill(newUser.fullName);
    await createDialog
      .getByRole('textbox', { name: 'Email *' })
      .fill(newUser.email);
    await createDialog
      .getByRole('textbox', { name: 'Fecha de nacimiento' })
      .fill(newUser.birthDate);

    await createDialog
      .getByRole('combobox')
      .filter({ hasText: 'Administrador' })
      .click();
    await page.getByRole('option', { name: 'Administrador' }).click();

    await createDialog
      .getByRole('textbox', { name: 'DNI/Pasaporte *' })
      .fill(newUser.dni);
    await createDialog
      .getByRole('textbox', { name: 'Nombre de usuario *' })
      .fill(newUser.username);
    await createDialog
      .getByRole('textbox', { name: 'Contraseña *' })
      .fill(newUser.password);

    await createDialog.getByRole('button', { name: 'Guardar' }).click();

    const confirmDialog = page.getByRole('dialog', {
      name: /Estás por crear un usuario Administrador/i,
    });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog
      .getByRole('textbox')
      .fill(getAdminCredentials().password);
    await confirmDialog.getByRole('button', { name: 'Confirmar' }).click();

    const credentialsDialog = page.getByRole('dialog', {
      name: 'Usuario creado',
    });
    await expect(credentialsDialog).toBeVisible({ timeout: 15_000 });
    await expect(credentialsDialog.getByText(newUser.username)).toBeVisible();
    await expect(credentialsDialog.getByText(newUser.password)).toBeVisible();

    await credentialsDialog.getByRole('button', { name: 'Close' }).click();

    await page.reload();
    await page.getByPlaceholder('Nombre, DNI, mail...').fill(newUser.email);
    await expect(page.getByText(newUser.fullName)).toBeVisible();

    createdUser = {
      fullName: newUser.fullName,
      username: newUser.username,
      password: newUser.password,
    };
  });

  test('logout and login with created user', async ({ page }) => {
    expect(createdUser).not.toBeNull();

    await page.goto('/admin/settings');
    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await expect(page).toHaveURL(/\/login/);

    await loginAsUser(page, createdUser!);

    await expect(
      page.getByText(`${createdUser!.fullName} (Administrador)`),
    ).toBeVisible();
  });
});
