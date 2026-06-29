import 'dotenv/config';

import test, { expect } from '@playwright/test';

import { waitForPaidTicketConfirmation } from './helpers/mercadopago-checkout';
import {
  approvePaidTicketForE2e,
  assertMercadoPagoPreferenceCreated,
  canRunPaidTicketE2eTests,
  extractTicketGroupIdFromUrl,
  getTicketGroupStatus,
  preventMercadoPagoRedirect,
} from './helpers/paid-ticket-e2e';
import {
  completePaidTicketCheckout,
  findFirstEventWithPaidTicket,
  getPaidTicketRow,
  paidTicketTestUse,
} from './helpers/paid-ticket-flow';

test.use(paidTicketTestUse);
test.setTimeout(120_000);

test('adquirir ticket pago y confirmar compra', async ({ page }) => {
  test.skip(
    !canRunPaidTicketE2eTests(),
    'Definí DATABASE_URL en .env (misma base que TEST_BASE_URL)',
  );

  await preventMercadoPagoRedirect(page);

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
  await paidTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page.getByText(event.eventName)).toBeVisible();
  await completePaidTicketCheckout(page, buyer);

  await assertMercadoPagoPreferenceCreated(page);

  const ticketGroupId = extractTicketGroupIdFromUrl(page.url());
  expect(ticketGroupId).toBeTruthy();

  await expect
    .poll(() => getTicketGroupStatus(page, ticketGroupId!))
    .toBe('BOOKED');

  await approvePaidTicketForE2e(ticketGroupId!);

  await expect
    .poll(() => getTicketGroupStatus(page, ticketGroupId!))
    .toBe('PAID');

  await page.goto(`/tickets/${ticketGroupId}`);
  await waitForPaidTicketConfirmation(page);
});

test('webhook de Mercado Pago rechaza firma inválida', async ({ page }) => {
  const response = await page.request.post('/api/mercadopago', {
    headers: {
      'x-signature': 'ts=0,v1=invalid',
      'x-request-id': 'invalid-request',
    },
    data: {
      data: { id: '123456789' },
    },
  });

  expect(response.status()).toBe(403);
});
