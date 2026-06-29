import 'dotenv/config';

import test, { expect } from '@playwright/test';

import {
  completeMercadoPagoCheckout,
  getMercadoPagoCredentialsFromEnv,
  waitForMercadoPagoRedirect,
  waitForPaidTicketConfirmation,
} from './helpers/mercadopago-checkout';
import {
  fillCheckoutForm,
  findFirstEventWithPaidTicket,
  getPaidTicketRow,
  paidTicketTestUse,
} from './helpers/paid-ticket-flow';

test.use(paidTicketTestUse);
test.setTimeout(240_000);

test('adquirir ticket pago con Mercado Pago real', async ({ page }) => {
  const mpCredentials = getMercadoPagoCredentialsFromEnv();
  test.skip(
    process.env.E2E_MERCADOPAGO_LIVE !== 'true' ||
      (!mpCredentials && !process.env.MP_STORAGE_STATE),
    'Solo corre con E2E_MERCADOPAGO_LIVE=true y MP_CHECKOUT_USER o MP_STORAGE_STATE',
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
  await paidTicketRow.getByRole('combobox').click();
  await page.getByRole('option', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  await fillCheckoutForm(page, buyer);
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await waitForMercadoPagoRedirect(page);
  await completeMercadoPagoCheckout(
    page,
    mpCredentials ?? { user: '', payWith: 'balance' },
  );
  await waitForPaidTicketConfirmation(page);
});
