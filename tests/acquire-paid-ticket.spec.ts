import 'dotenv/config';

import test, { expect } from '@playwright/test';

import { waitForPaidTicketConfirmation } from './helpers/mercadopago-checkout';
import {
  extractTicketGroupIdFromUrl,
  getTicketGroupStatus,
  preventMercadoPagoRedirect,
  triggerMercadoPagoWebhook,
} from './helpers/mercadopago-webhook';
import {
  completePaidTicketCheckout,
  findFirstEventWithPaidTicket,
  getPaidTicketRow,
  paidTicketTestUse,
} from './helpers/paid-ticket-flow';

test.use(paidTicketTestUse);
test.setTimeout(120_000);

test('adquirir ticket pago y confirmar vía webhook de Mercado Pago', async ({
  page,
}) => {
  test.skip(
    process.env.E2E_MOCK_MP_WEBHOOK !== 'true',
    'Activá E2E_MOCK_MP_WEBHOOK=true y MP_SECRET_KEY en .env (solo local)',
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

  const ticketGroupId = extractTicketGroupIdFromUrl(page.url());
  expect(ticketGroupId).toBeTruthy();

  await expect
    .poll(() => getTicketGroupStatus(page, ticketGroupId!))
    .toBe('BOOKED');

  await triggerMercadoPagoWebhook(page, ticketGroupId!);

  await expect
    .poll(() => getTicketGroupStatus(page, ticketGroupId!))
    .toBe('PAID');

  await page.goto(`/tickets/${ticketGroupId}`);
  await waitForPaidTicketConfirmation(page);
});

test('webhook de Mercado Pago rechaza firma inválida', async ({ page }) => {
  test.skip(
    process.env.E2E_MOCK_MP_WEBHOOK !== 'true',
    'Activá E2E_MOCK_MP_WEBHOOK=true en .env',
  );

  const response = await page.request.post('/api/mercadopago', {
    headers: {
      'x-signature': 'ts=0,v1=invalid',
      'x-request-id': 'invalid-request',
    },
    data: {
      data: { id: 'e2e-00000000-0000-4000-8000-000000000000' },
    },
  });

  expect(response.status()).toBe(403);
});
