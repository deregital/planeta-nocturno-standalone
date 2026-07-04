import { createHmac } from 'node:crypto';

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
  // Bloquear la navegación a MP en el nivel de JavaScript.
  // pending.tsx usa `window.location.href = url` que no pasa por .assign()/.replace(),
  // así que hay que interceptar el setter de .href directamente.
  await page.addInitScript(() => {
    const MP = /mercadopago\.com/i;

    // Interceptar location.href setter
    const hrefDescriptor = Object.getOwnPropertyDescriptor(
      Location.prototype,
      'href',
    );
    if (hrefDescriptor?.set) {
      Object.defineProperty(Location.prototype, 'href', {
        ...hrefDescriptor,
        set(url: string) {
          if (MP.test(String(url))) return; // ignorar navegaciones a MP
          hrefDescriptor.set!.call(this, url);
        },
      });
    }

    // Interceptar también .assign() y .replace() como fallback
    const originalAssign = Location.prototype.assign;
    const originalReplace = Location.prototype.replace;
    Location.prototype.assign = function (url) {
      if (MP.test(String(url))) return;
      return originalAssign.call(this, url);
    };
    Location.prototype.replace = function (url) {
      if (MP.test(String(url))) return;
      return originalReplace.call(this, url);
    };
  });

  // Bloquear también a nivel de red como respaldo
  await page.route(/mercadopago\.com/i, (route) => {
    if (route.request().isNavigationRequest()) {
      // Intentar volver a la página de tickets desde el referer o la URL actual
      const referer = route.request().headers().referer ?? '';
      const baseURL = (
        process.env.TEST_BASE_URL ?? 'https://localhost:3000'
      ).replace(/\/$/, '');
      const ticketMatch = referer.match(/\/tickets\/([0-9a-f-]{36})/i);
      const location = ticketMatch
        ? `${baseURL}/tickets/${ticketMatch[1]}`
        : referer || `${baseURL}/`;
      return route.fulfill({ status: 302, headers: { Location: location } });
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

/**
 * Genera una firma HMAC-SHA256 válida para el webhook de MercadoPago.
 * Reproduce el mismo algoritmo que usa el endpoint /api/mercadopago.
 *
 * La firma tiene el formato: `ts={timestamp},v1={hmac_hex}`
 * El manifest que se firma es: `id:{dataId};request-id:{requestId};ts:{ts};`
 */
export function generateMercadoPagoWebhookSignature(
  secretKey: string,
  dataId: string,
  requestId: string,
): { signature: string; requestId: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', secretKey).update(manifest).digest('hex');
  return { signature: `ts=${ts},v1=${v1}`, requestId };
}

export function canRunWebhookSignatureTest() {
  return Boolean(process.env.MP_SECRET_KEY?.trim());
}

export function canRunFullMpCheckoutTests() {
  return Boolean(
    process.env.MP_CHECKOUT_USER?.trim() ||
      process.env.MP_CHECKOUT_EMAIL?.trim(),
  );
}

/**
 * El test de checkout completo con cuenta de prueba solo puede correr si el
 * servidor usa credenciales de PRUEBA de MP. Con un token de producción, MP
 * bloquea los pagos de cuentas de prueba con el error "una de las partes es
 * de prueba".
 *
 * Indicar explícitamente que el token es de prueba con:
 *   MP_ACCESS_TOKEN_IS_TEST=true
 *
 * Si no está definido, el test se ejecuta igualmente (asume prueba en local).
 */
export function mpAccessTokenIsTest() {
  // Si está explícitamente marcado como producción, no correr
  if (process.env.MP_ACCESS_TOKEN_IS_TEST?.trim().toLowerCase() === 'false') {
    return false;
  }
  // Si está explícitamente marcado como prueba, correr
  if (process.env.MP_ACCESS_TOKEN_IS_TEST?.trim().toLowerCase() === 'true') {
    return true;
  }
  // Heurística: los tokens de prueba suelen venir de apps en modo sandbox.
  // Si el server es localhost, asumir prueba. Si es remoto, asumir producción
  // a menos que el usuario lo indique.
  const testUrl = process.env.TEST_BASE_URL ?? 'https://localhost:3000';
  return testUrl.includes('localhost') || testUrl.includes('127.0.0.1');
}
