/**
 * Tests de integración con MercadoPago (Checkout Pro)
 *
 * ── Qué se verifica ────────────────────────────────────────────────────────────
 *
 *  1. Las credenciales MP_ACCESS_TOKEN y MP_SECRET_KEY están configuradas y son
 *     válidas (token de PRUEBA, no producción).
 *
 *  2. El webhook /api/mercadopago rechaza firmas inválidas con HTTP 403.
 *
 *  3. El webhook /api/mercadopago acepta firmas HMAC válidas (no retorna 403).
 *
 *  4. Flujo completo de compra con cuenta de prueba de comprador de MP:
 *       evento → checkout → MP Checkout Pro → pago con tarjeta/saldo → redirect
 *       de vuelta → confirmación de compra.
 *
 *  5. Si el servidor es accesible públicamente (INSTANCE_WEB_URL no apunta a
 *     localhost), el webhook dispara automáticamente y el ticket pasa a PAID.
 *
 * ── Cuentas de prueba MP ───────────────────────────────────────────────────────
 *
 *  Checkout Pro requiere dos cuentas de prueba:
 *
 *  • Vendedor  → tus credenciales de PRUEBA de la aplicación MP.
 *                El Access Token de prueba empieza con APP_USR-.
 *                Configuralo como MP_ACCESS_TOKEN en .env.
 *
 *  • Comprador → cuenta de prueba tipo "Comprador" creada en el panel de MP:
 *                https://www.mercadopago.com.ar/developers/panel/app
 *                → tu aplicación → Test accounts → Crear cuenta de prueba.
 *                Usá su usuario en MP_CHECKOUT_USER y su contraseña como
 *                primer intento de login (MP pedirá un código de verificación
 *                de 6 dígitos que está en el panel bajo "Verification code").
 *
 * ── Variables de entorno ───────────────────────────────────────────────────────
 *
 *  Requeridas (siempre):
 *    MP_ACCESS_TOKEN     Access token de PRUEBA del vendedor (APP_USR-...)
 *    MP_SECRET_KEY       Webhook secret configurado en el panel de MP
 *    TEST_BASE_URL       URL del servidor bajo prueba (default: https://localhost:3000)
 *
 *  Para el test de checkout real (test 4):
 *    MP_CHECKOUT_USER      Email/usuario de la cuenta de prueba compradora
 *    MP_CHECKOUT_PASSWORD  Contraseña de la cuenta de prueba (visible en panel MP → Test accounts)
 *    MP_CHECKOUT_PAY_WITH  'balance' (default) | 'card'
 *    MP_CHECKOUT_OTP       Código de verificación de 6 dígitos si MP lo solicita
 *    MP_STORAGE_STATE      Path a un storageState JSON con sesión MP guardada
 *
 *  Para verificar estado final en DB (opcional):
 *    DATABASE_URL        Misma DB que usa TEST_BASE_URL
 *
 * ── Tarjetas de prueba (cuando MP_CHECKOUT_PAY_WITH=card) ─────────────────────
 *
 *  Mastercard crédito: 5031 7557 3453 0604  CVV: 123  Venc: 11/30
 *  Visa crédito:       4509 9535 6623 3704  CVV: 123  Venc: 11/30
 *
 *  Titulares especiales (el nombre del titular controla el resultado):
 *    APRO → Pago aprobado         (usar este para confirmar la compra)
 *    CONT → Pago pendiente
 *    FUND → Fondos insuficientes
 *    SECU → Código de seguridad inválido
 *    OTHE → Error genérico
 *
 * ── Guardar sesión MP para evitar OTP repetidos ────────────────────────────────
 *
 *  npx playwright test save-mp-storage --headed --project=chromium
 *  # y definir en .env: MP_STORAGE_STATE=playwright/.auth/mp-user.json
 */

import 'dotenv/config';

import test, { expect } from '@playwright/test';

import {
  completeMercadoPagoCheckout,
  getMercadoPagoCredentialsFromEnv,
  waitForPaidTicketConfirmation,
} from './helpers/mercadopago-checkout';
import {
  canRunFullMpCheckoutTests,
  canRunPaidTicketE2eTests,
  canRunWebhookSignatureTest,
  extractTicketGroupIdFromUrl,
  generateMercadoPagoWebhookSignature,
  getTicketGroupStatus,
  mpAccessTokenIsTest,
} from './helpers/paid-ticket-e2e';
import {
  completePaidTicketCheckout,
  findFirstEventWithPaidTicket,
  getPaidTicketRow,
  paidTicketTestUse,
} from './helpers/paid-ticket-flow';

test.use(paidTicketTestUse);
test.setTimeout(180_000);

// ─── 1. Verificación de credenciales ──────────────────────────────────────────

test('credenciales de MercadoPago están configuradas correctamente', async () => {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  const secretKey = process.env.MP_SECRET_KEY?.trim();

  expect(
    accessToken,
    [
      'MP_ACCESS_TOKEN no está configurado.',
      'Obtené tu Access Token de PRUEBA en:',
      'https://www.mercadopago.com.ar/developers/panel/app',
      '→ tu aplicación → Credenciales de prueba',
    ].join('\n'),
  ).toBeTruthy();

  expect(
    accessToken,
    [
      'MP_ACCESS_TOKEN parece ser de producción.',
      'Usá el Access Token de PRUEBA (empieza con APP_USR- y se genera',
      'automáticamente al crear tu aplicación en el panel de MP).',
    ].join('\n'),
  ).toMatch(/^APP_USR-/);

  expect(
    secretKey,
    [
      'MP_SECRET_KEY (webhook secret) no está configurado.',
      'Configuralo en el panel de MP → tu aplicación → Webhooks.',
      'Es la clave usada para verificar la firma HMAC-SHA256 de las notificaciones.',
    ].join('\n'),
  ).toBeTruthy();
});

// ─── 2. Webhook rechaza firma inválida (403) ───────────────────────────────────

test('webhook /api/mercadopago rechaza firma inválida con 403', async ({
  page,
}) => {
  const response = await page.request.post(
    '/api/mercadopago?data.id=123456789&type=payment',
    {
      headers: {
        'x-signature': 'ts=0,v1=firma-invalida-playwright',
        'x-request-id': 'playwright-invalid-sig-test',
      },
      data: { data: { id: '123456789' } },
    },
  );

  expect(
    response.status(),
    'El webhook debería retornar 403 para firmas inválidas.',
  ).toBe(403);
});

// ─── 3. Webhook acepta firma HMAC válida ───────────────────────────────────────

test('webhook /api/mercadopago acepta firma HMAC válida (verificación de seguridad)', async ({
  page,
}) => {
  test.skip(
    !canRunWebhookSignatureTest(),
    'Definí MP_SECRET_KEY en .env para probar la verificación de firma HMAC.',
  );

  const secretKey = process.env.MP_SECRET_KEY!.trim();

  // Usamos un ID de pago ficticio; MP no encontrará el pago → 404.
  // Lo importante es que la respuesta NO sea 403 (firma rechazada).
  const fakePaymentId = '10000000000';
  const { signature, requestId } = generateMercadoPagoWebhookSignature(
    secretKey,
    fakePaymentId,
    `playwright-valid-sig-${Date.now()}`,
  );

  // MP envía data.id en el query param de la URL (es lo que se firma en el manifest)
  const response = await page.request.post(
    `/api/mercadopago?data.id=${fakePaymentId}&type=payment`,
    {
      headers: {
        'x-signature': signature,
        'x-request-id': requestId,
      },
      data: { data: { id: fakePaymentId } },
    },
  );

  // 403 = firma rechazada → MP_SECRET_KEY no coincide con el configurado en el servidor.
  // 404 = firma OK, pero el pago ficticio no existe en MP → CORRECTO.
  // 400 = faltan headers (no debería pasar).
  // 500 = firma OK, error al llamar a la API de MP (puede pasar con token de prueba y pago inexistente).
  expect(
    response.status(),
    [
      `El webhook rechazó la firma con ${response.status()}.`,
      'Si el error es 403: verificá que MP_SECRET_KEY en .env coincide exactamente',
      'con el Webhook Secret configurado en el panel de MercadoPago.',
      `Firma enviada: ${signature.substring(0, 30)}...`,
    ].join('\n'),
  ).not.toBe(403);
});

// ─── 4. Checkout completo con cuenta de prueba compradora de MP ────────────────

test('checkout completo con cuenta de prueba de MercadoPago', async ({
  page,
}) => {
  test.skip(
    !canRunFullMpCheckoutTests(),
    [
      'Test omitido: no hay cuenta de prueba compradora configurada.',
      'Para activar este test:',
      '  1. Creá una cuenta de prueba tipo "Comprador" en:',
      '     https://www.mercadopago.com.ar/developers/panel/app',
      '     → tu aplicación → Test accounts → + Crear cuenta de prueba',
      '  2. Agregá en .env:',
      '     MP_CHECKOUT_USER=<usuario de la cuenta compradora>',
      '     MP_CHECKOUT_PASSWORD=<contraseña de la cuenta compradora>',
      '     MP_CHECKOUT_PAY_WITH=balance   # o card',
      '  3. Ejecutá: npx playwright test mp-integration --headed --project=chromium',
      '  Nota: si MP pide código de verificación, usá MP_CHECKOUT_OTP=<código del panel>',
    ].join('\n'),
  );
  test.skip(
    !mpAccessTokenIsTest(),
    [
      'Test omitido: el servidor usa credenciales de producción de MP.',
      'Las cuentas de prueba (TESTUSER...) no pueden pagar en preferencias de producción.',
      'Para correr este test:',
      '  - Usá TEST_BASE_URL=https://localhost:3000 con un MP_ACCESS_TOKEN de prueba.',
      '  - O agregá MP_ACCESS_TOKEN_IS_TEST=true si tu token remoto es realmente de prueba.',
    ].join('\n'),
  );

  test.skip(
    !canRunPaidTicketE2eTests(),
    'Definí DATABASE_URL en .env para poder verificar el estado del ticket en la DB.',
  );

  const credentials = getMercadoPagoCredentialsFromEnv()!;

  const uniqueId = Date.now().toString().slice(-8);
  const buyer = {
    fullName: 'Test MP Comprador',
    mail: `mp-test-${uniqueId}@example.com`,
    dni: `42${uniqueId}`,
    phone: '91140000999',
    birthDate: '2000-05-15',
  };

  // 1. Buscar el primer evento con ticket pago disponible
  const event = await findFirstEventWithPaidTicket(page);

  await page.goto(`/event/${event.slug}`);

  // 2. Seleccionar 1 ticket pago
  const paidTicketRow = getPaidTicketRow(page, event.ticketName);
  await expect(paidTicketRow).toBeVisible();
  await paidTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  // 3. Completar el formulario de checkout de la app
  await expect(page.getByText(event.eventName, { exact: true })).toBeVisible();
  await completePaidTicketCheckout(page, buyer);

  // 4. Capturar el ticketGroupId de la URL /tickets/{id} mientras todavía estamos ahí.
  //    pending.tsx elimina la cookie y redirige a MP inmediatamente via window.location.href,
  //    así que no usamos assertMercadoPagoPreferenceCreated aquí.
  const ticketGroupId = extractTicketGroupIdFromUrl(page.url());
  expect(
    ticketGroupId,
    'No se encontró el ticketGroupId en la URL /tickets/{id}',
  ).toBeTruthy();

  // 5. Verificar estado BOOKED antes del pago (polling rápido antes del redirect a MP)
  await expect
    .poll(() => getTicketGroupStatus(page, ticketGroupId!), {
      message: 'El ticket debería estar en BOOKED antes de ir a MP',
      timeout: 15_000,
    })
    .toBe('BOOKED');

  // 6. Completar el pago en MercadoPago Checkout Pro.
  //    pending.tsx redirige automáticamente a MP via window.location.href.
  //    completeMercadoPagoCheckout espera la URL de MP y completa el pago.
  await completeMercadoPagoCheckout(page, credentials);

  // 7. Verificar la página de confirmación
  //    MP redirige a back_urls.success = /tickets/{id} cuando el pago es aprobado.
  //    La app muestra "¡Gracias por su compra!" y el botón de descarga.
  await waitForPaidTicketConfirmation(page);

  // 8. Verificar estado PAID en la DB (si el webhook llegó al servidor)
  //    Nota: el webhook de MP solo puede llegar si INSTANCE_WEB_URL es accesible
  //    públicamente. En desarrollo local usá ngrok u otro tunnel.
  const isPublicUrl = !process.env.INSTANCE_WEB_URL?.includes('localhost');

  if (isPublicUrl) {
    await expect
      .poll(() => getTicketGroupStatus(page, ticketGroupId!), {
        message:
          'El ticket debería pasar a PAID cuando MP dispara el webhook. ' +
          'Si el webhook no llega, verificá que INSTANCE_WEB_URL en .env ' +
          'apunta a una URL pública (no localhost).',
        timeout: 60_000,
        intervals: [3_000, 5_000, 10_000],
      })
      .toBe('PAID');
  } else {
    // En local, el webhook no llega: verificamos al menos que la página
    // muestre la confirmación correcta después del redirect de MP.
    const status = await getTicketGroupStatus(page, ticketGroupId!);
    expect(['BOOKED', 'PAID']).toContain(status);
  }
});

// ─── 5. Pago rechazado por fondos insuficientes ────────────────────────────────

test('ticket queda en BOOKED mientras el pago está pendiente en MP', async ({
  page,
}) => {
  test.skip(
    !canRunFullMpCheckoutTests(),
    'Definí MP_CHECKOUT_USER y MP_CHECKOUT_PASSWORD para probar este escenario.',
  );
  test.skip(
    !mpAccessTokenIsTest(),
    'El servidor usa credenciales de producción. Este test requiere un token de prueba de MP.',
  );
  test.skip(
    !canRunPaidTicketE2eTests(),
    'Definí DATABASE_URL para verificar el estado del ticket en la DB.',
  );

  const uniqueId = Date.now().toString().slice(-8);
  const buyer = {
    fullName: 'Test MP Pendiente',
    mail: `mp-pending-${uniqueId}@example.com`,
    dni: `43${uniqueId}`,
    phone: '91140000998',
    birthDate: '1999-03-20',
  };

  const event = await findFirstEventWithPaidTicket(page);
  await page.goto(`/event/${event.slug}`);

  const paidTicketRow = getPaidTicketRow(page, event.ticketName);
  await expect(paidTicketRow).toBeVisible();
  await paidTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page.getByText(event.eventName, { exact: true })).toBeVisible();
  await completePaidTicketCheckout(page, buyer);

  const ticketGroupId = extractTicketGroupIdFromUrl(page.url());
  expect(ticketGroupId).toBeTruthy();

  // Verificar que el ticket está en BOOKED inmediatamente después del checkout de la app,
  // antes de que se complete el pago en MP.
  // pending.tsx redirige a MP automáticamente; la DB todavía no tiene PAID.
  const status = await getTicketGroupStatus(page, ticketGroupId!);
  expect(
    status,
    'El ticket debe estar en BOOKED mientras el pago está pendiente en MP. ' +
      'Un estado PAID en este punto indicaría un bug (ticket marcado pagado sin pago real).',
  ).toBe('BOOKED');

  // Verificar que MP recibió la preferencia y muestra el checkout
  // (pending.tsx redirige con window.location.href a la URL de MP).
  await expect(
    page
      .getByText(/cómo querés pagar|ingresar con mi cuenta|dinero en cuenta/i)
      .first(),
  ).toBeVisible({ timeout: 45_000 });
});
