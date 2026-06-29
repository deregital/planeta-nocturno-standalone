import { expect, type Page } from '@playwright/test';

import { markTicketGroupAsPaid } from './db';

export function extractTicketGroupIdFromUrl(url: string) {
  const match = url.match(/\/tickets\/([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

export function canRunPaidTicketE2eTests() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function assertMercadoPagoPreferenceCreated(page: Page) {
  const cookies = await page.context().cookies();
  const paymentUrl = cookies.find(
    (cookie) => cookie.name === 'pendingPaymentUrl',
  )?.value;

  expect(
    paymentUrl,
    'No se creó la preferencia de Mercado Pago (falta cookie pendingPaymentUrl)',
  ).toBeTruthy();
  expect(paymentUrl).toMatch(/mercadopago\.com/i);
}

export async function preventMercadoPagoRedirect(page: Page) {
  const baseURL = (
    process.env.TEST_BASE_URL ?? 'https://localhost:3000'
  ).replace(/\/$/, '');

  await page.addInitScript(() => {
    const mercadoPagoPattern = /mercadopago\.com/i;
    const originalAssign = Location.prototype.assign;
    const originalReplace = Location.prototype.replace;

    Location.prototype.assign = function (url: string | URL) {
      if (mercadoPagoPattern.test(String(url))) return;
      return originalAssign.call(this, url);
    };

    Location.prototype.replace = function (url: string | URL) {
      if (mercadoPagoPattern.test(String(url))) return;
      return originalReplace.call(this, url);
    };
  });

  await page.route(/mercadopago\.com/i, (route) => {
    if (route.request().isNavigationRequest()) {
      const referer = route.request().headers().referer ?? '';
      const ticketMatch = referer.match(/\/tickets\/([0-9a-f-]{36})/i);
      const location = ticketMatch
        ? `${baseURL}/tickets/${ticketMatch[1]}`
        : referer || `${baseURL}/`;

      return route.fulfill({
        status: 302,
        headers: { Location: location },
      });
    }

    return route.abort();
  });
}

export async function getTicketGroupStatus(page: Page, ticketGroupId: string) {
  const response = await page.request.get('/api/trpc/ticketGroup.findById', {
    params: { input: JSON.stringify({ json: ticketGroupId }) },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.result.data.json.status as string;
}

export async function approvePaidTicketForE2e(ticketGroupId: string) {
  await markTicketGroupAsPaid(ticketGroupId);
}
