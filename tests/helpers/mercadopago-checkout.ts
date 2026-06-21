import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { expect, type Locator, type Page } from '@playwright/test';

export type MercadoPagoCheckoutCredentials = {
  user: string;
  otp?: string;
  payWith: 'card' | 'balance';
};

const TEST_CARD = {
  number: '5031755734530604',
  holderName: 'APRO',
  expiry: '1130',
  cvv: '123',
  dni: '12345678',
};

async function clickFirstVisible(page: Page, locators: Locator[]) {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout: 2000 }).catch(() => false)) {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click();
      return true;
    }
  }
  return false;
}

async function waitForMercadoLibreAuthProgress(page: Page) {
  const otpInput = mercadoLibreOtpInput(page);

  await Promise.race([
    otpInput.waitFor({ state: 'visible', timeout: 15_000 }),
    page.waitForURL(/phone-validation|challenge|validation|code/i, {
      timeout: 15_000,
    }),
    page
      .getByText(
        /código de verificación|ingresá el código|te enviamos|validá tu/i,
      )
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 }),
  ]).catch(() => {});
}

async function selectMercadoLibreSmsMethod(page: Page) {
  const otpInput = mercadoLibreOtpInput(page);

  if (await otpInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    return;
  }

  const selected = await clickFirstVisible(page, [
    page
      .getByRole('listitem')
      .filter({ hasText: /\bsms\b/i })
      .getByRole('radio'),
    page.getByRole('listitem').filter({ hasText: /\bsms\b/i }),
    page.getByRole('radio', { name: /sms/i }),
    page.getByRole('button', { name: /sms/i }),
    page.locator('button, a, [role="button"]').filter({ hasText: /\bsms\b/i }),
  ]);

  if (
    !selected &&
    !(await otpInput.isVisible({ timeout: 1000 }).catch(() => false))
  ) {
    throw new Error(
      'No se encontró el método SMS después de ingresar el usuario.',
    );
  }

  if (!(await otpInput.isVisible({ timeout: 1500 }).catch(() => false))) {
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^continuar$/i }),
      page.getByRole('button', { name: /enviar código/i }),
      page.getByRole('button', { name: /enviar/i }),
    ]);
    await waitForMercadoLibreAuthProgress(page);
  }
}

async function confirmSmsCodeDelivery(page: Page) {
  const otpInput = mercadoLibreOtpInput(page);
  if (await otpInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    return;
  }

  if (!page.url().includes('phone-validation')) {
    return;
  }

  await clickFirstVisible(page, [
    page.getByRole('listitem').filter({ hasText: /\bsms\b/i }),
    page.getByRole('button', { name: /sms/i }),
    page.getByRole('button', { name: /whatsapp/i }),
  ]);

  await waitForMercadoLibreAuthProgress(page);

  if (!(await otpInput.isVisible({ timeout: 1500 }).catch(() => false))) {
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^continuar$/i }),
      page.getByRole('button', { name: /enviar/i }),
    ]);
  }
}

async function fillFirstVisible(
  page: Page,
  locators: Locator[],
  value: string,
) {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout: 2000 }).catch(() => false)) {
      await target.fill(value);
      return true;
    }
  }
  return false;
}

function isMercadoLibreLoginUrl(url: string) {
  return /mercadolibre\.com.*login|mercadopago\.com.*login/i.test(url);
}

function isMercadoPagoCheckoutUrl(url: string) {
  return /mercadopago\.com\.ar.*(checkout|payment)/i.test(url);
}

function mercadoPagoLoginTrigger(page: Page) {
  return page.getByRole('button', { name: /ingresar con mi cuenta/i });
}

async function needsMercadoPagoLogin(page: Page) {
  await page.waitForLoadState('domcontentloaded');

  if (isMercadoLibreLoginUrl(page.url())) {
    return true;
  }

  return mercadoPagoLoginTrigger(page)
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
}

async function openMercadoPagoAccountLogin(page: Page) {
  if (isMercadoLibreLoginUrl(page.url())) return;

  const loginTrigger = mercadoPagoLoginTrigger(page);
  await expect(loginTrigger).toBeVisible({ timeout: 20_000 });
  await loginTrigger.click();
  await page.waitForURL((url) => isMercadoLibreLoginUrl(url.toString()), {
    timeout: 30_000,
  });
}

async function assertMercadoLibreLoginAllowed(page: Page) {
  if (page.url().includes('no-feasible-authenticators')) {
    throw new Error(
      'Mercado Libre bloqueó el login automático (límite de intentos). ' +
        'Esperá unos minutos o guardá sesión con: npx playwright test save-mp-storage --headed ' +
        'y definí MP_STORAGE_STATE=playwright/.auth/mp-user.json en .env',
    );
  }

  if (
    await page
      .getByText(/límite de intentos/i)
      .isVisible({ timeout: 2000 })
      .catch(() => false)
  ) {
    throw new Error(
      'Mercado Libre bloqueó el login (límite de intentos). ' +
        'Esperá e intentá de nuevo, o usá MP_STORAGE_STATE.',
    );
  }
}

async function fillMercadoLibreUserInput(userInput: Locator, user: string) {
  await userInput.click({ clickCount: 3 });
  await userInput.pressSequentially(user, { delay: 40 });

  if ((await userInput.inputValue()) !== user) {
    await userInput.fill(user);
  }

  await expect(userInput).toHaveValue(user, { timeout: 5000 });
}

async function submitMercadoLibreIdentifier(page: Page, user: string) {
  const userInput = page
    .locator('#user_id, input[name="user_id"]')
    .or(page.getByRole('textbox', { name: /DNI, e-mail o teléfono/i }))
    .first();
  await expect(userInput).toBeVisible({ timeout: 20_000 });
  await fillMercadoLibreUserInput(userInput, user);
  await page.getByRole('button', { name: /^continuar$/i }).click();

  await Promise.race([
    page
      .getByText(/\bsms\b/i)
      .first()
      .waitFor({ state: 'visible', timeout: 25_000 }),
    page
      .locator(
        'input[inputmode="numeric"], input[name="code"], input[autocomplete="one-time-code"]',
      )
      .first()
      .waitFor({ state: 'visible', timeout: 25_000 }),
    page.waitForURL(/no-feasible-authenticators/, { timeout: 25_000 }),
  ]).catch(() => {});

  await assertMercadoLibreLoginAllowed(page);

  const stillOnIdentifier = await userInput.isVisible().catch(() => false);
  const otpVisible = await page
    .locator('input[inputmode="numeric"]')
    .first()
    .isVisible()
    .catch(() => false);
  const smsOptionVisible = await page
    .getByText(/\bsms\b/i)
    .first()
    .isVisible()
    .catch(() => false);

  if (stillOnIdentifier && !otpVisible && !smsOptionVisible) {
    throw new Error(
      'Mercado Libre no avanzó después de ingresar el usuario. Verificá MP_CHECKOUT_USER o usá MP_STORAGE_STATE.',
    );
  }
}

function mercadoLibreOtpInput(page: Page) {
  return page
    .locator(
      'input[inputmode="numeric"], input[name="code"], input[autocomplete="one-time-code"], input[name="otp"]',
    )
    .first();
}

async function submitMercadoLibreSmsLogin(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await assertMercadoLibreLoginAllowed(page);

  await selectMercadoLibreSmsMethod(page);
  await confirmSmsCodeDelivery(page);

  if (page.url().includes('phone-validation')) {
    return;
  }

  const otpInput = mercadoLibreOtpInput(page);
  await expect(
    otpInput,
    'No apareció el campo para el código SMS después de elegir SMS',
  ).toBeVisible({ timeout: 60_000 });
}

function shouldUseBrowserForOtp(): boolean {
  const mode = process.env.MP_CHECKOUT_OTP_MODE?.trim().toLowerCase();
  if (mode === 'browser') return true;
  if (mode === 'terminal') return false;
  // Playwright UI mode runs workers without a TTY; readline prompts do not work there.
  return !process.stdin.isTTY;
}

async function resolveOtpCode(
  providedOtp?: string,
): Promise<string | 'browser'> {
  if (providedOtp?.trim()) {
    return providedOtp.trim();
  }

  if (process.env.MP_CHECKOUT_OTP?.trim()) {
    return process.env.MP_CHECKOUT_OTP.trim();
  }

  if (process.env.CI) {
    throw new Error(
      'Mercado Pago pidió un código SMS. En CI usá MP_CHECKOUT_OTP o MP_STORAGE_STATE.',
    );
  }

  if (shouldUseBrowserForOtp()) {
    return 'browser';
  }

  console.log(
    '\nMercado Pago envió un código por SMS/WhatsApp.',
    'Cuando lo recibas, ingresalo acá en la terminal.\n',
  );

  const rl = createInterface({ input, output });
  try {
    const code = await rl.question('Código de verificación (6 dígitos): ');
    const trimmed = code.trim();

    if (!trimmed) {
      throw new Error('No se ingresó ningún código de verificación.');
    }

    return trimmed;
  } finally {
    rl.close();
  }
}

async function handlePhoneValidationIfNeeded(page: Page, otp?: string) {
  if (!page.url().includes('phone-validation')) {
    return;
  }

  const selected = await clickFirstVisible(page, [
    page.getByRole('listitem').filter({ hasText: /\bsms\b/i }),
    page.getByRole('button', { name: /sms/i }),
    page.getByRole('button', { name: /whatsapp/i }),
  ]);

  if (!selected) {
    throw new Error(
      'Mercado Pago pidió verificación telefónica. No se encontró el método SMS/WhatsApp.',
    );
  }

  await page
    .locator(
      'input[inputmode="numeric"], input[name="code"], input[autocomplete="one-time-code"], input[name="otp"]',
    )
    .first()
    .waitFor({ state: 'visible', timeout: 120_000 })
    .catch(() => {});

  await handleMercadoLibreOtp(page, otp);
}

async function handleMercadoLibreOtp(page: Page, otp?: string) {
  const otpInput = mercadoLibreOtpInput(page);

  if (!(await otpInput.isVisible({ timeout: 8000 }).catch(() => false))) {
    return;
  }

  const code = await resolveOtpCode(otp);

  if (code === 'browser') {
    console.log(
      '\nMercado Pago pidió código SMS/WhatsApp.',
      'Ingresalo en el browser, confirmá, y reanudá el test desde la UI de Playwright (▶).\n',
    );
    await page.pause();
    await otpInput
      .waitFor({ state: 'hidden', timeout: 120_000 })
      .catch(() => {});
    return;
  }

  await otpInput.fill(code);
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /continuar|confirmar|validar|ingresar/i }),
    page.locator('button[type="submit"]'),
  ]);
}

async function waitForMercadoPagoCheckoutAfterLogin(page: Page) {
  await page.waitForURL(
    (url) =>
      isMercadoPagoCheckoutUrl(url.toString()) ||
      (!isMercadoLibreLoginUrl(url.toString()) &&
        url.hostname.includes('mercadopago')),
    { timeout: 90_000 },
  );
}

export async function loginToMercadoPago(
  page: Page,
  credentials: MercadoPagoCheckoutCredentials,
) {
  if (!(await needsMercadoPagoLogin(page))) return;

  await openMercadoPagoAccountLogin(page);
  await submitMercadoLibreIdentifier(page, credentials.user);
  await submitMercadoLibreSmsLogin(page);
  await handleMercadoLibreOtp(page, credentials.otp);
  await handlePhoneValidationIfNeeded(page, credentials.otp);
  await handleMercadoLibreOtp(page, credentials.otp);
  await waitForMercadoPagoCheckoutAfterLogin(page);
}

async function payWithAccountBalance(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});

  await clickFirstVisible(page, [
    page.getByRole('radio', { name: /dinero en cuenta/i }),
    page.getByText(/dinero en cuenta/i),
    page.getByText(/saldo disponible/i),
    page.locator('[data-testid*="account_money"]'),
  ]);

  const paid = await clickFirstVisible(page, [
    page.getByRole('button', { name: /pagar/i }),
    page.getByRole('button', { name: /confirmar/i }),
    page.getByRole('button', { name: /continuar/i }),
    page.locator('button[type="submit"]'),
  ]);

  expect(paid, 'No se encontró el botón para confirmar el pago').toBe(true);
}

async function payWithGuestTestCard(page: Page) {
  const selected = await clickFirstVisible(page, [
    page.getByRole('button', { name: /tarjeta/i }),
    page.getByText(/tarjeta de crédito/i),
    page.getByText(/tarjeta de débito/i),
    page.getByText(/nueva tarjeta/i),
  ]);
  expect(selected, 'No se encontró la opción de pagar con tarjeta').toBe(true);

  await page.waitForLoadState('domcontentloaded');

  const cardNumberLocator = page
    .frameLocator('iframe')
    .locator(
      '#cardNumber, input[name="cardNumber"], input[autocomplete="cc-number"], input[placeholder*="mero"]',
    )
    .first()
    .or(
      page
        .locator(
          '#cardNumber, input[name="cardNumber"], input[autocomplete="cc-number"]',
        )
        .first(),
    );

  await expect(cardNumberLocator).toBeVisible({ timeout: 20_000 });
  await cardNumberLocator.fill(TEST_CARD.number);

  await fillFirstVisible(
    page,
    [
      page.locator('#cardholderName'),
      page.getByLabel(/titular|nombre/i),
      page.locator('input[name="cardholderName"]'),
    ],
    TEST_CARD.holderName,
  );

  await fillFirstVisible(
    page,
    [
      page.locator('#cardholderIdentificationNumber'),
      page.getByLabel(/documento|dni/i),
      page.locator('input[name="cardholderIdentificationNumber"]'),
    ],
    TEST_CARD.dni,
  );

  await fillFirstVisible(
    page,
    [
      page.locator('#expirationDate'),
      page.getByLabel(/vencimiento|expiration/i),
      page.locator('input[name="expirationDate"]'),
    ],
    TEST_CARD.expiry,
  );

  await fillFirstVisible(
    page,
    [
      page.locator('#securityCode'),
      page.getByLabel(/código de seguridad|cvv/i),
      page.locator('input[name="securityCode"]'),
    ],
    TEST_CARD.cvv,
  );

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /^continuar$/i }),
    page.getByRole('button', { name: /^pagar$/i }),
    page.getByRole('button', { name: /confirmar/i }),
    page.locator('button[type="submit"]'),
  ]);
}

async function payWithLoggedInAccount(page: Page, payWith: 'card' | 'balance') {
  await page.waitForLoadState('domcontentloaded');

  if (payWith === 'balance') {
    await payWithAccountBalance(page);
    return;
  }

  const usedSavedCard = await clickFirstVisible(page, [
    page.locator('[data-testid*="card"]').first(),
    page.getByText(/terminada en/i),
  ]);

  if (usedSavedCard) {
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^pagar$/i }),
      page.getByRole('button', { name: /confirmar/i }),
    ]);
    return;
  }

  await payWithGuestTestCard(page);
}

export async function waitForMercadoPagoRedirect(page: Page) {
  await page.waitForURL(/\/tickets\/|mercadopago/, { timeout: 45_000 });

  if (page.url().includes('mercadopago')) {
    await expect(
      page
        .getByText(/cómo querés pagar|ingresar con mi cuenta|dinero en cuenta/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    return;
  }

  try {
    await page.waitForURL(/mercadopago/, { timeout: 30_000 });
    await expect(
      page
        .getByText(/cómo querés pagar|ingresar con mi cuenta|dinero en cuenta/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
    return;
  } catch {
    const pendingUrl = (await page.context().cookies()).find(
      (cookie) => cookie.name === 'pendingPaymentUrl',
    )?.value;

    if (pendingUrl) {
      await page.goto(pendingUrl);
      await page.waitForURL(/mercadopago/, { timeout: 30_000 });
      await expect(
        page
          .getByText(
            /cómo querés pagar|ingresar con mi cuenta|dinero en cuenta/i,
          )
          .first(),
      ).toBeVisible({ timeout: 30_000 });
      return;
    }

    throw new Error(
      'No se pudo abrir el checkout de Mercado Pago. Verificá bypassCSP: true en el test.',
    );
  }
}

export async function completeMercadoPagoCheckout(
  page: Page,
  credentials: MercadoPagoCheckoutCredentials,
) {
  if (!page.url().includes('mercadopago')) {
    await waitForMercadoPagoRedirect(page);
  }

  const useGuestCheckout =
    process.env.MP_CHECKOUT_USE_GUEST?.trim().toLowerCase() === 'true';

  if (useGuestCheckout) {
    await payWithGuestTestCard(page);
  } else if (await needsMercadoPagoLogin(page)) {
    if (!credentials.user) {
      throw new Error(
        'No hay sesión activa en Mercado Pago. Definí MP_CHECKOUT_USER o MP_STORAGE_STATE.',
      );
    }
    await loginToMercadoPago(page, credentials);
    await page.waitForLoadState('networkidle').catch(() => {});
    await payWithLoggedInAccount(page, credentials.payWith);
  } else {
    await page.waitForLoadState('networkidle').catch(() => {});
    await payWithLoggedInAccount(page, credentials.payWith);
  }

  await handlePhoneValidationIfNeeded(page, credentials.otp);
  await handleMercadoLibreOtp(page, credentials.otp);

  await page.waitForURL(
    (url) =>
      !url.hostname.includes('mercadopago') &&
      !url.hostname.includes('mercadolibre') &&
      url.pathname.includes('/tickets/'),
    { timeout: 120_000 },
  );
}

export async function waitForPaidTicketConfirmation(page: Page) {
  const successMessage = page.getByText('¡Gracias por su compra!');
  const processingMessage = page.getByText('Procesando tu pago...');

  await expect(successMessage.or(processingMessage)).toBeVisible({
    timeout: 60_000,
  });

  if (await processingMessage.isVisible()) {
    await expect(successMessage).toBeVisible({ timeout: 120_000 });
  }

  await expect(
    page.getByRole('button', { name: 'Descargar Tickets' }),
  ).toBeVisible();
}

export function getMercadoPagoCredentialsFromEnv(): MercadoPagoCheckoutCredentials | null {
  const user =
    process.env.MP_CHECKOUT_USER?.trim() ||
    process.env.MP_CHECKOUT_EMAIL?.trim();

  if (!user) {
    return null;
  }

  const payWith =
    process.env.MP_CHECKOUT_PAY_WITH?.trim().toLowerCase() === 'card'
      ? 'card'
      : 'balance';

  return {
    user,
    otp: process.env.MP_CHECKOUT_OTP?.trim(),
    payWith,
  };
}
