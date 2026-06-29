import { createHmac, randomUUID } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

export function extractTicketGroupIdFromUrl(url: string) {
  const match = url.match(/\/tickets\/([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
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

/** @deprecated Usar preventMercadoPagoRedirect */
export async function blockMercadoPagoRedirect(page: Page) {
  await preventMercadoPagoRedirect(page);
}

export function buildE2eMockPaymentId(ticketGroupId: string) {
  return `e2e-${ticketGroupId}`;
}

export function buildMercadoPagoWebhookHeaders(paymentId: string) {
  const secretKey = process.env.MP_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      'MP_SECRET_KEY es requerido para firmar el webhook de prueba.',
    );
  }

  const requestId = randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secretKey).update(manifest).digest('hex');

  return {
    'x-signature': `ts=${ts},v1=${v1}`,
    'x-request-id': requestId,
  };
}

export async function getTicketGroupStatus(page: Page, ticketGroupId: string) {
  const response = await page.request.get('/api/trpc/ticketGroup.findById', {
    params: { input: JSON.stringify({ json: ticketGroupId }) },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.result.data.json.status as string;
}

export async function triggerMercadoPagoWebhook(
  page: Page,
  ticketGroupId: string,
) {
  const paymentId = buildE2eMockPaymentId(ticketGroupId);
  const headers = buildMercadoPagoWebhookHeaders(paymentId);

  const response = await page.request.post('/api/mercadopago', {
    headers,
    data: {
      data: { id: paymentId },
    },
  });

  expect(response.status(), `Webhook falló: ${await response.text()}`).toBe(
    200,
  );
}
