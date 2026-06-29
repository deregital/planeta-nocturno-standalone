import 'dotenv/config';
import path from 'node:path';

import test, { expect, type Locator, type Page } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

test.use({ baseURL: process.env.TEST_BASE_URL });
test.setTimeout(120_000);

const COVER_IMAGE = path.join(__dirname, 'fixtures', 'cover.png');
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

type CreatedEvent = {
  name: string;
  ticketName: string;
  slug: string;
  locationLabel: string;
  categoryLabel: string;
  updatedLocationLabel?: string;
};

let createdEvent: CreatedEvent | null = null;

async function selectExistingOption(page: Page, index = 0): Promise<string> {
  const options = page.getByRole('option').filter({ hasNotText: /crear/i });
  const count = await options.count();
  expect(count).toBeGreaterThan(0);

  const option = options.nth(Math.min(index, count - 1));
  const text = (await option.textContent())?.trim() ?? '';
  await option.click();
  return text;
}

async function uploadEventCover(page: Page) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Agregar flyer').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(COVER_IMAGE);

  const cropDialog = page.getByRole('dialog', { name: 'Recortar portada' });
  await expect(cropDialog).toBeVisible();
  await cropDialog.getByRole('button', { name: 'Usar recorte' }).click();
  await expect(
    page.getByRole('button', { name: 'Cambiar imagen' }),
  ).toBeVisible({ timeout: 30_000 });
}

async function replaceEventCover(page: Page) {
  await page.getByRole('button', { name: 'Cambiar imagen' }).click();
  await uploadEventCover(page);
}

async function selectOptionByPattern(
  page: Page,
  pattern: RegExp,
): Promise<string> {
  const option = page.getByRole('option', { name: pattern });
  const text = (await option.textContent())?.trim() ?? '';
  await option.click();
  return text;
}

async function fillGeneralInformation(
  page: Page,
  data: {
    name: string;
    description: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    locationPattern?: RegExp;
    categoryPattern?: RegExp;
  },
): Promise<{ locationLabel: string; categoryLabel: string }> {
  await page.getByRole('textbox', { name: 'Nombre *' }).fill(data.name);
  await page
    .getByRole('textbox', { name: 'Descripción *' })
    .fill(data.description);
  await page.getByRole('textbox', { name: 'Fecha *' }).fill(data.eventDate);
  await page.getByRole('textbox', { name: 'Inicio *' }).fill(data.startTime);
  await page
    .getByRole('textbox', { name: 'Finalización *' })
    .fill(data.endTime);

  await page
    .getByRole('combobox')
    .filter({ hasText: 'Selecciona una opción' })
    .first()
    .click();
  const locationLabel = data.locationPattern
    ? await selectOptionByPattern(page, data.locationPattern)
    : await selectExistingOption(page, 0);

  await page
    .getByRole('combobox')
    .filter({ hasText: 'Selecciona una opción' })
    .click();
  const categoryLabel = data.categoryPattern
    ? await selectOptionByPattern(page, data.categoryPattern)
    : await selectExistingOption(page, 0);

  return { locationLabel, categoryLabel };
}

async function submitTicketDialog(
  ticketDialog: Locator,
  submitLabel: 'Crear' | 'Editar',
) {
  for (const id of [
    'startingDateEnabled',
    'scanLimitEnabled',
    'maxSellDateEnabled',
    'lowStockThresholdEnabled',
  ]) {
    const checkbox = ticketDialog.locator(`#${id}`);
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  await ticketDialog.getByRole('button', { name: submitLabel }).click();
  await expect(ticketDialog).not.toBeVisible({ timeout: 15_000 });
}

async function createFreeTicket(
  page: Page,
  ticketName: string,
  maxAvailable: string,
) {
  await page.getByRole('button', { name: 'Free', exact: true }).click();

  const ticketDialog = page.getByRole('dialog', {
    name: /Crear ticket de tipo Free/i,
  });
  await expect(ticketDialog).toBeVisible();
  await ticketDialog.locator('#name').fill(ticketName);
  await ticketDialog.locator('#description').fill('Ticket gratuito de prueba');
  await ticketDialog
    .getByRole('spinbutton', {
      name: /Cantidad maxima de tickets \(Tickets restantes/i,
    })
    .fill(maxAvailable);
  await submitTicketDialog(ticketDialog, 'Crear');
}

async function storeCreatedEventSlug(
  page: Page,
  data: {
    eventName: string;
    ticketName: string;
    locationLabel: string;
    categoryLabel: string;
  },
) {
  const eventCard = page
    .locator('[data-slot="card-content"]')
    .filter({ hasText: data.eventName });
  const href = await eventCard
    .locator('a[href^="/admin/event/"]')
    .first()
    .getAttribute('href');
  expect(href).toBeTruthy();
  createdEvent = {
    name: data.eventName,
    ticketName: data.ticketName,
    slug: href!.replace('/admin/event/', ''),
    locationLabel: data.locationLabel,
    categoryLabel: data.categoryLabel,
  };
}

async function openEventEditPage(page: Page, eventName: string) {
  await page.goto('/admin/event');
  await expect(page.getByText(eventName)).toBeVisible();

  const eventCard = page
    .locator('[data-slot="card-content"]')
    .filter({ hasText: eventName });
  const href = await eventCard
    .locator('a[href^="/admin/event/"]')
    .first()
    .getAttribute('href');
  const slug = href!.replace('/admin/event/', '');

  await page.goto(`/admin/event/edit/${slug}`);
  await expect(
    page.getByRole('heading', { name: 'Editar Evento' }),
  ).toBeVisible();
}

async function addSurveyQuestion(page: Page, question: string) {
  await page.getByRole('button', { name: 'Agregar pregunta' }).click();
  await page
    .getByRole('textbox', { name: /Pregunta \d+/ })
    .last()
    .fill(question);
}

async function closeOverlays(page: Page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

async function addTicketingUser(page: Page) {
  const accessSection = page.locator('section').filter({ hasText: 'Acceso' });
  await accessSection.getByRole('combobox').click();
  const userOption = page.locator('[data-slot="command-item"]').first();
  if (await userOption.isVisible()) {
    await userOption.click();
  }
  await closeOverlays(page);
}

test.describe.serial('eventos admin', () => {
  test('crear evento desde cero', async ({ page }) => {
    const uniqueId = Date.now().toString().slice(-8);
    const eventName = `Evento Playwright ${uniqueId}`;
    const ticketName = `Entrada Free ${uniqueId}`;

    await loginAsAdmin(page);
    await page.goto('/admin/event/create');

    await expect(
      page.getByRole('heading', { name: 'Crear evento' }),
    ).toBeVisible();

    await uploadEventCover(page);
    const { locationLabel, categoryLabel } = await fillGeneralInformation(
      page,
      {
        name: eventName,
        description: 'Evento creado automáticamente por Playwright.',
        eventDate: '2026-12-15',
        startTime: '20:00',
        endTime: '23:00',
      },
    );

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: /Simple/i }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await createFreeTicket(page, ticketName, '10');
    await expect(page.getByText(ticketName)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      page.getByRole('heading', { name: 'Previsualización del evento' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Nombre *' })).toHaveValue(
      eventName,
    );
    await page.getByRole('button', { name: 'Crear y publicar' }).click();

    await expect(page).toHaveURL(/\/admin\/event$/, { timeout: 30_000 });
    await expect(page.getByText(eventName)).toBeVisible();
    await storeCreatedEventSlug(page, {
      eventName,
      ticketName,
      locationLabel,
      categoryLabel,
    });
  });

  test('editar evento y actualizar todos los campos', async ({ page }) => {
    expect(createdEvent).not.toBeNull();

    const uniqueId = Date.now().toString().slice(-6);
    const updatedEventName = `${createdEvent!.name} Editado ${uniqueId}`;
    const updatedTicketName = `${createdEvent!.ticketName} Editado`;
    const updatedPaidTicketName = `Entrada Paga ${uniqueId}`;
    const surveyQuestion = `¿Cómo te enteraste del evento? ${uniqueId}`;

    await loginAsAdmin(page);
    await openEventEditPage(page, createdEvent!.name);

    await replaceEventCover(page);

    await page
      .getByRole('textbox', { name: 'Nombre *' })
      .fill(updatedEventName);
    await page
      .getByRole('textbox', { name: 'Descripción *' })
      .fill('Descripción actualizada por Playwright con todos los campos.');

    await page.getByRole('button', { name: 'YouTube' }).click();
    await page.locator('#videoUrl').fill(YOUTUBE_URL);

    await page.getByRole('textbox', { name: 'Fecha *' }).fill('2026-12-20');
    await page.getByRole('textbox', { name: 'Inicio *' }).fill('19:00');
    await page.getByRole('textbox', { name: 'Finalización *' }).fill('01:00');

    await page.locator('#minAgeEnabled').check();
    await page.locator('#minAge').fill('18');

    await page.locator('#extraTicketData').check();

    const locationCategorySection = page
      .locator('section')
      .filter({ hasText: 'Ubicación y categoría' });
    await locationCategorySection.getByRole('combobox').first().click();
    const updatedLocationLabel = await selectExistingOption(page, 1);
    await closeOverlays(page);

    await locationCategorySection.getByRole('combobox').nth(1).click();
    await selectExistingOption(page, 1);
    await closeOverlays(page);

    await addTicketingUser(page);

    await page
      .getByPlaceholder('correo@ejemplo.com')
      .fill(`playwright-${uniqueId}@example.com`);

    await page.locator('#serviceFeeEnabled').check();
    await page.locator('#serviceFee').fill('5');

    await page.locator('#ticketSlugVisibleInPdf').check();
    await page.locator('#hasSimpleInvitation').check();

    await addSurveyQuestion(page, surveyQuestion);

    const ticketsSection = page.locator('#ticket-types');
    const existingTicketRow = ticketsSection
      .locator('li')
      .filter({ hasText: createdEvent!.ticketName });
    await existingTicketRow.locator('button').nth(1).click();

    const editTicketDialog = page.getByRole('dialog', {
      name: /Crear ticket de tipo Free/i,
    });
    await expect(editTicketDialog).toBeVisible();
    await editTicketDialog.locator('#name').fill(updatedTicketName);
    await editTicketDialog
      .locator('#description')
      .fill('Ticket free editado por Playwright');
    await editTicketDialog
      .getByRole('spinbutton', {
        name: /Cantidad maxima de tickets \(Tickets restantes/i,
      })
      .fill('15');
    await submitTicketDialog(editTicketDialog, 'Editar');

    await ticketsSection
      .getByRole('button', { name: 'Pago', exact: true })
      .click();
    const paidTicketDialog = page.getByRole('dialog', {
      name: /Crear ticket de tipo Pago/i,
    });
    await expect(paidTicketDialog).toBeVisible();
    await paidTicketDialog.locator('#name').fill(updatedPaidTicketName);
    await paidTicketDialog
      .locator('#description')
      .fill('Ticket pago agregado en edición');
    await paidTicketDialog.locator('#price').fill('1500');
    await paidTicketDialog
      .getByRole('spinbutton', {
        name: /Cantidad maxima de tickets \(Tickets restantes/i,
      })
      .fill('5');
    await submitTicketDialog(paidTicketDialog, 'Crear');

    await expect(ticketsSection.getByText(updatedTicketName)).toBeVisible();
    await expect(ticketsSection.getByText(updatedPaidTicketName)).toBeVisible();

    await page.getByRole('button', { name: 'Actualizar' }).click();

    await expect(page).toHaveURL(/\/admin\/event$/, { timeout: 30_000 });
    await expect(page.getByText(updatedEventName)).toBeVisible();

    await openEventEditPage(page, updatedEventName);

    await expect(page.getByRole('textbox', { name: 'Nombre *' })).toHaveValue(
      updatedEventName,
    );
    await expect(
      page.getByRole('textbox', { name: 'Descripción *' }),
    ).toHaveValue(
      'Descripción actualizada por Playwright con todos los campos.',
    );
    await page.getByRole('button', { name: /YouTube|Ver video/i }).click();
    await expect(page.locator('#videoUrl')).toHaveValue(YOUTUBE_URL);
    await expect(page.getByRole('textbox', { name: 'Fecha *' })).toHaveValue(
      '2026-12-20',
    );
    await expect(page.getByRole('textbox', { name: 'Inicio *' })).toHaveValue(
      '19:00',
    );
    await expect(page.locator('#minAgeEnabled')).toBeChecked();
    await expect(page.locator('#minAge')).toHaveValue('18');
    await expect(page.locator('#extraTicketData')).toBeChecked();
    await expect(
      page
        .getByRole('combobox')
        .filter({ hasText: updatedLocationLabel.split(' (')[0] }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('correo@ejemplo.com')).toHaveValue(
      `playwright-${uniqueId}@example.com`,
    );
    await expect(page.locator('#serviceFeeEnabled')).toBeChecked();
    await expect(page.locator('#serviceFee')).toHaveValue('5');
    await expect(page.locator('#ticketSlugVisibleInPdf')).toBeChecked();
    await expect(page.locator('#hasSimpleInvitation')).toBeChecked();
    await expect(
      page.getByRole('textbox', { name: /Pregunta 1/i }),
    ).toHaveValue(surveyQuestion);
    await expect(
      page.locator('#ticket-types').getByText(updatedTicketName),
    ).toBeVisible();
    await expect(
      page.locator('#ticket-types').getByText(updatedPaidTicketName),
    ).toBeVisible();

    createdEvent = {
      ...createdEvent!,
      name: updatedEventName,
      ticketName: updatedTicketName,
      updatedLocationLabel,
    };
  });
});
