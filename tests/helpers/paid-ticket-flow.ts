import { expect, type Page } from '@playwright/test';

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

export const paidTicketTestUse = {
  baseURL: process.env.TEST_BASE_URL,
  bypassCSP: true,
  ...(process.env.MP_STORAGE_STATE
    ? { storageState: process.env.MP_STORAGE_STATE }
    : {}),
  launchOptions: {
    args: ['--disable-blink-features=AutomationControlled'],
  },
};

export async function findFirstEventWithPaidTicket(page: Page) {
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

export function getPaidTicketRow(page: Page, ticketName: string) {
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

export async function fillCheckoutForm(
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

export async function completePaidTicketCheckout(
  page: Page,
  buyer: Parameters<typeof fillCheckoutForm>[1],
) {
  await expect(page).toHaveURL(/\/checkout/);
  await fillCheckoutForm(page, buyer);

  const comprarButton = page.getByRole('button', { name: 'COMPRAR' });
  await expect(comprarButton).toBeEnabled();
  await comprarButton.click();

  try {
    await page.waitForURL(/\/tickets\/[0-9a-f-]{36}/i, {
      timeout: 60_000,
      waitUntil: 'commit',
    });
  } catch {
    const errorText = await page
      .locator('.text-destructive, [role="alert"]')
      .allInnerTexts();
    throw new Error(
      `Checkout no llegó a /tickets/. URL: ${page.url()}. Errores: ${errorText.join(' | ') || 'sin mensajes visibles'}`,
    );
  }

  await page.waitForLoadState('domcontentloaded');
}
