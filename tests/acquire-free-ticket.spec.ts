import test, { expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.TEST_BASE_URL });
test.setTimeout(60_000);

type ActiveEvent = {
  slug: string;
  name: string;
  ticketTypes: Array<{
    name: string;
    category: string;
    visibleInWeb: boolean;
    maxSellDate: string | null;
  }>;
};

async function findFirstEventWithFreeTicket(page: Page) {
  const response = await page.request.get('/api/trpc/events.getActive', {
    params: { input: JSON.stringify({ json: null }) },
  });
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  const events = body.result.data.json as ActiveEvent[];
  const now = new Date();

  for (const event of events) {
    const freeTicket = event.ticketTypes.find(
      (ticket) =>
        ticket.category === 'FREE' &&
        ticket.visibleInWeb &&
        ticket.maxSellDate &&
        new Date(ticket.maxSellDate) > now,
    );

    if (freeTicket) {
      return {
        slug: event.slug,
        eventName: event.name,
        ticketName: freeTicket.name,
      };
    }
  }

  throw new Error(
    'No se encontró ningún evento con ticket gratuito disponible',
  );
}

async function fillSurveyQuestions(page: Page) {
  const surveyInputs = page.locator('input[name^="question_"]');
  const count = await surveyInputs.count();

  for (let i = 0; i < count; i++) {
    await surveyInputs.nth(i).fill('Playwright test');
  }
}

test('adquirir ticket gratuito', async ({ page }) => {
  const uniqueId = Date.now().toString().slice(-8);
  const buyer = {
    fullName: 'Test Playwright',
    mail: `test-${uniqueId}@example.com`,
    dni: `40${uniqueId}`,
    phone: '91140000999',
    birthDate: '2000-05-15',
  };

  const event = await findFirstEventWithFreeTicket(page);

  await page.goto(`/event/${event.slug}`);

  await expect(page.getByText(event.ticketName)).toBeVisible();
  await expect(page.getByText('GRATUITO').first()).toBeVisible();

  const freeTicketRow = page
    .locator('.flex.flex-col.gap-2')
    .filter({ hasText: event.ticketName })
    .filter({ hasText: 'GRATUITO' });
  await freeTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();

  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText(event.eventName)).toBeVisible();

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

  await fillSurveyQuestions(page);

  const invitaInput = page.getByLabel('Invita');
  if (await invitaInput.isVisible()) {
    await invitaInput.fill('Playwright test');
  }

  await page.getByRole('button', { name: 'ADQUIRIR' }).click();

  await expect(page).toHaveURL(/\/tickets\//, { timeout: 30_000 });
  await expect(page.getByText('¡Gracias por su compra!')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar Tickets' }),
  ).toBeVisible();
});
