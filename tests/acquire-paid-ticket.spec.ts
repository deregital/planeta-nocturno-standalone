import 'dotenv/config';

import test, { expect, type Page } from '@playwright/test';

// eslint-disable-next-line no-restricted-imports
import {
  completeMercadoPagoCheckout,
  getMercadoPagoCredentialsFromEnv,
  waitForMercadoPagoRedirect,
  waitForPaidTicketConfirmation,
} from './helpers/mercadopago-checkout';

test.use({
  baseURL: process.env.TEST_BASE_URL,
  bypassCSP: true,
  ...(process.env.MP_STORAGE_STATE
    ? { storageState: process.env.MP_STORAGE_STATE }
    : {}),
  launchOptions: {
    args: ['--disable-blink-features=AutomationControlled'],
  },
});
test.setTimeout(240_000);

type ActiveEvent = {
  slug: string;
  name: string;
  ticketTypes: Array<{
    name: string;
    category: string;
    price: number | null;
    visibleInWeb: boolean;
    maxSellDate: string | null;
  }>;
};

async function findFirstEventWithPaidTicket(page: Page) {
  const response = await page.request.get('/api/trpc/events.getActive', {
    params: { input: JSON.stringify({ json: null }) },
  });
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  const events = body.result.data.json as ActiveEvent[];
  const now = new Date();

  for (const event of events) {
    const paidTicket = event.ticketTypes.find(
      (ticket) =>
        ticket.category === 'PAID' &&
        (ticket.price ?? 0) > 0 &&
        ticket.visibleInWeb &&
        ticket.maxSellDate &&
        new Date(ticket.maxSellDate) > now,
    );

    if (paidTicket) {
      return {
        slug: event.slug,
        eventName: event.name,
        ticketName: paidTicket.name,
        price: paidTicket.price ?? 0,
      };
    }
  }

  throw new Error('No se encontró ningún evento con ticket pago disponible');
}

function getPaidTicketRow(page: Page, ticketName: string) {
  return page
    .locator('.flex.flex-col.gap-2')
    .filter({ hasText: ticketName })
    .filter({ hasText: /\$\s*[\d.]+/ })
    .filter({ hasNotText: 'GRATUITO' });
}

async function fillSurveyQuestions(page: Page) {
  const surveyInputs = page.locator('input[name^="question_"]');
  const count = await surveyInputs.count();

  for (let i = 0; i < count; i++) {
    await surveyInputs.nth(i).fill('Playwright test');
  }
}

async function fillCheckoutForm(
  page: Page,
  buyer: {
    fullName: string;
    mail: string;
    dni: string;
    phone: string;
    birthDate: string;
  },
) {
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
}

test('adquirir ticket pago con Mercado Pago', async ({ page }) => {
  const mpCredentials = getMercadoPagoCredentialsFromEnv();
  test.skip(
    !mpCredentials && !process.env.MP_STORAGE_STATE,
    'Definí MP_CHECKOUT_USER en .env, o MP_STORAGE_STATE con sesión guardada',
  );

  const uniqueId = Date.now().toString().slice(-8);
  const buyer = {
    fullName: 'Test Playwright Pago',
    mail: `paid-${uniqueId}@example.com`,
    dni: `42${uniqueId}`,
    phone: '91140000999',
    birthDate: '2000-05-15',
  };

  const event = await findFirstEventWithPaidTicket(page);

  await page.goto(`/event/${event.slug}`);

  const paidTicketRow = getPaidTicketRow(page, event.ticketName);
  await expect(paidTicketRow).toBeVisible();
  await expect(paidTicketRow.getByText(/\$\s*[\d.]+/)).toBeVisible();
  await paidTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();

  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByText(event.eventName)).toBeVisible();
  await expect(page.getByRole('button', { name: 'COMPRAR' })).toBeVisible();

  await fillCheckoutForm(page, buyer);
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await waitForMercadoPagoRedirect(page);
  await completeMercadoPagoCheckout(
    page,
    mpCredentials ?? { user: '', payWith: 'balance' },
  );
  await waitForPaidTicketConfirmation(page);
});
