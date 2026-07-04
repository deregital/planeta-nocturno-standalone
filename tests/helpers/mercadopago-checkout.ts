import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

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

  // El campo de contraseña de ML puede ser type="password" o type="text" dependiendo
  // del estado del toggle "Mostrar contraseña". Usamos el nombre accesible.
  const passwordInput = page.getByRole('textbox', { name: /contraseña/i });

  // Esperar a que aparezca cualquiera de los siguientes:
  // - Selector de método de verificación ("Contraseña", "E-mail")
  // - Campo de contraseña directamente
  // - Campo OTP numérico
  // - Opción SMS
  // - Bloqueo por intentos
  const methodSelectorButton = page.getByRole('button', {
    name: /contraseña.*ingresarás|ingresarás tu contraseña/i,
  });

  await Promise.race([
    methodSelectorButton.waitFor({ state: 'visible', timeout: 25_000 }),
    passwordInput.waitFor({ state: 'visible', timeout: 25_000 }),
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

  // Caso 1: ML muestra la pantalla "Elegí un método de verificación".
  // Para cuentas de prueba siempre elegimos "Contraseña".
  if (
    await methodSelectorButton.isVisible({ timeout: 2000 }).catch(() => false)
  ) {
    await methodSelectorButton.click();
    // Esperar la pantalla de contraseña (heading específico)
    await expect(
      page.getByRole('heading', { name: /ingresá tu contraseña/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
  }

  // Caso 2: ML muestra directamente el campo de contraseña.
  const onPasswordPage = await page
    .getByRole('heading', { name: /ingresá tu contraseña/i })
    .isVisible({ timeout: 3_000 })
    .catch(() => false);

  if (onPasswordPage) {
    const password = process.env.MP_CHECKOUT_PASSWORD?.trim();
    if (!password) {
      throw new Error(
        'Mercado Libre pide contraseña pero MP_CHECKOUT_PASSWORD no está definido en .env.\n' +
          'Obtené la contraseña en: https://www.mercadopago.com.ar/developers/panel/app\n' +
          '→ tu app → Test accounts → columna Password',
      );
    }

    // Usar pressSequentially para asegurar que React detecte el input
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.pressSequentially(password, { delay: 40 });
    await expect(passwordInput).not.toHaveValue('', { timeout: 3_000 });

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^confirmar$/i }),
      page.getByRole('button', { name: /^continuar$/i }),
      page.getByRole('button', { name: /^ingresar$/i }),
      page.locator('button[type="submit"]'),
    ]);

    // Después de la contraseña puede aparecer OTP, email verification, o redirigir directo al checkout
    await Promise.race([
      page
        .locator(
          'input[inputmode="numeric"], input[name="code"], input[autocomplete="one-time-code"]',
        )
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 }),
      page
        .getByText(/\bsms\b/i)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 }),
      page
        .waitForURL((url) => !isMercadoLibreLoginUrl(url.toString()), {
          timeout: 40_000,
        })
        .catch(() => {}),
    ]).catch(() => {});

    return;
  }

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

async function handleEmailValidationIfNeeded(page: Page, otp?: string) {
  if (!page.url().includes('email-validation')) {
    return;
  }

  const code = await resolveOtpCode(otp);

  if (code === 'browser') {
    console.log(
      '\nMercado Pago pide código de verificación por e-mail.',
      'Ingresalo en el browser y reanudá el test desde la UI de Playwright (▶).\n',
    );
    await page.pause();
    await page
      .waitForURL((url) => !url.toString().includes('email-validation'), {
        timeout: 120_000,
      })
      .catch(() => {});
    return;
  }

  // ML usa un textbox por dígito ("Dígito 1" a "Dígito 6")
  const digits = code.split('');
  for (let i = 0; i < Math.min(digits.length, 6); i++) {
    const box = page.getByRole('textbox', {
      name: new RegExp(`dígito ${i + 1}`, 'i'),
    });
    if (await box.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await box.click();
      await box.fill(digits[i]);
    }
  }

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /verificar/i }),
    page.getByRole('button', { name: /continuar/i }),
    page.getByRole('button', { name: /confirmar/i }),
  ]);

  const leftEmailValidation = await page
    .waitForURL((url) => !url.toString().includes('email-validation'), {
      timeout: 15_000,
    })
    .then(() => true)
    .catch(() => false);

  if (!leftEmailValidation) {
    throw new Error(
      [
        `El código de verificación de e-mail es incorrecto (MP_CHECKOUT_OTP=${code}).`,
        'El código correcto está en el panel de MP:',
        '  https://www.mercadopago.com.ar/developers/panel/app',
        '  → tu app → Test accounts → cuenta TESTUSER... → columna "Verification code"',
        '',
        'Actualizá MP_CHECKOUT_OTP en .env con ese valor y volvé a correr el test.',
      ].join('\n'),
    );
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

  // Después del identificador (y la contraseña si se ingresó), verificar si el login
  // ya completó y redirigió fuera de la página de login. Esto pasa cuando la cuenta
  // no requiere verificación por OTP/SMS (e.g. contraseña sola es suficiente).
  if (!isMercadoLibreLoginUrl(page.url())) {
    await waitForMercadoPagoCheckoutAfterLogin(page);
    return;
  }

  // Todavía en la página de login → continuar con el flujo de OTP/SMS.
  await submitMercadoLibreSmsLogin(page);
  await handleMercadoLibreOtp(page, credentials.otp);
  await handlePhoneValidationIfNeeded(page, credentials.otp);
  await handleMercadoLibreOtp(page, credentials.otp);
  await waitForMercadoPagoCheckoutAfterLogin(page);
}

async function payWithAccountBalance(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {});

  // Si la página muestra "Ingresar con mi cuenta", no se logró el login.
  const isGuestCheckout = await page
    .getByRole('button', { name: /ingresar con mi cuenta/i })
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (isGuestCheckout) {
    throw new Error(
      [
        'No se puede pagar con saldo: el usuario no está logueado en MercadoPago.',
        'La página muestra el checkout de invitado en lugar del checkout con cuenta.',
        'Opciones para resolverlo:',
        '  1. Verificá MP_CHECKOUT_PASSWORD y MP_CHECKOUT_OTP en .env (ver panel MP → Test accounts)',
        '  2. Cambiá MP_CHECKOUT_PAY_WITH=card para pagar sin login con tarjeta de prueba',
        '  3. Usá MP_CHECKOUT_USE_GUEST=true para forzar pago como invitado con tarjeta',
      ].join('\n'),
    );
  }

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
  // Esperar a llegar a la página de MP Y a que su contenido esté visible.
  // Si ya estamos en mercadopago.com (porque pending.tsx ya redirigió), de todas
  // formas esperamos que el checkout renderice antes de evaluar needsMercadoPagoLogin.
  if (!page.url().includes('mercadopago')) {
    await waitForMercadoPagoRedirect(page);
  } else {
    // Ya estamos en MP pero el contenido puede no haber renderizado todavía.
    await expect(
      page
        .getByText(/cómo querés pagar|ingresar con mi cuenta|dinero en cuenta/i)
        .first(),
    ).toBeVisible({ timeout: 30_000 });
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

    // Esperar que la página se estabilice ANTES de verificar si el login fue exitoso.
    // Sin este wait, el check puede correr mientras la página todavía está navegando.
    await page.waitForLoadState('networkidle').catch(() => {});

    const loginFailed = await needsMercadoPagoLogin(page);
    if (loginFailed) {
      // El login falló — intentar con tarjeta de prueba como invitado si es posible.
      // Esto puede pasar si MP_CHECKOUT_OTP o MP_CHECKOUT_PASSWORD son incorrectos.
      const canFallbackToCard = await page
        .getByRole('button', { name: /tarjeta/i })
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (canFallbackToCard) {
        console.warn(
          '\n⚠  Login a MercadoPago falló. Usando tarjeta de prueba como invitado.\n' +
            '   Para usar la cuenta compradora verificá en el panel de MP:\n' +
            '   → MP_CHECKOUT_PASSWORD (columna Password de la cuenta)\n' +
            '   → MP_CHECKOUT_OTP (columna Verification code, 6 dígitos)\n' +
            '   O guardá sesión: npx playwright test save-mp-storage --headed\n',
        );
        await payWithGuestTestCard(page);
      } else {
        throw new Error(
          [
            'El login a MercadoPago falló y no hay opción de pago como invitado disponible.',
            'Verificá en https://www.mercadopago.com.ar/developers/panel/app → Test accounts:',
            '  - MP_CHECKOUT_USER: usuario de la cuenta compradora',
            '  - MP_CHECKOUT_PASSWORD: contraseña (columna Password)',
            '  - MP_CHECKOUT_OTP: código de 6 dígitos (columna Verification code)',
            'O guardá sesión: npx playwright test save-mp-storage --headed --project=chromium',
            'y agregá en .env: MP_STORAGE_STATE=playwright/.auth/mp-user.json',
          ].join('\n'),
        );
      }
    } else {
      await payWithLoggedInAccount(page, credentials.payWith);
    }
  } else {
    await page.waitForLoadState('networkidle').catch(() => {});
    await payWithLoggedInAccount(page, credentials.payWith);
  }

  // Después de iniciar el pago, MP puede requerir pasos de verificación intermedios
  // (email-validation, phone-validation, OTP) antes de llegar a la URL final de la app.
  // Monitoreamos todas las posibles URLs hasta llegar a /tickets/.
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const url = page.url();

    if (!url.includes('mercadopago') && !url.includes('mercadolibre')) {
      break; // Llegamos a la URL final de la app
    }

    if (url.includes('email-validation')) {
      await handleEmailValidationIfNeeded(page, credentials.otp);
      continue;
    }

    if (url.includes('phone-validation')) {
      await handlePhoneValidationIfNeeded(page, credentials.otp);
      continue;
    }

    const otpVisible = await mercadoLibreOtpInput(page)
      .isVisible({ timeout: 1_000 })
      .catch(() => false);
    if (otpVisible) {
      await handleMercadoLibreOtp(page, credentials.otp);
      continue;
    }

    // Esperar que la URL cambie antes de re-chequear
    await page
      .waitForURL((next) => next.toString() !== url, {
        timeout: Math.min(30_000, deadline - Date.now()),
      })
      .catch(() => {});
  }

  await page
    .waitForURL(
      (url) =>
        !url.hostname.includes('mercadopago') &&
        !url.hostname.includes('mercadolibre') &&
        url.pathname.includes('/tickets/'),
      { timeout: 30_000 },
    )
    .catch(() => {
      throw new Error(
        `El test terminó sin llegar a /tickets/. URL actual: ${page.url()}`,
      );
    });
}

/**
 * Si E2E_MOCK_MP_WEBHOOK=true, simula el webhook de MP llamando directamente a
 * /api/mercadopago con el payment ID del query param collection_id.
 *
 * Permite que el test funcione en local donde MP no puede alcanzar localhost.
 * El endpoint verifica el pago contra la API de MP y marca el ticket como PAID.
 */
async function triggerWebhookIfMockEnabled(page: Page) {
  if (process.env.E2E_MOCK_MP_WEBHOOK?.trim().toLowerCase() !== 'true') return;

  const secretKey = process.env.MP_SECRET_KEY ?? process.env.E2E_WEBHOOK_SECRET;
  if (!secretKey) return;

  const url = new URL(page.url());
  const collectionId = url.searchParams.get('collection_id');
  const collectionStatus = url.searchParams.get('collection_status');

  if (!collectionId || collectionStatus !== 'approved') return;

  const { generateMercadoPagoWebhookSignature } = await import(
    './paid-ticket-e2e'
  );
  const requestId = crypto.randomUUID();
  const { signature } = generateMercadoPagoWebhookSignature(
    secretKey,
    collectionId,
    requestId,
  );

  const baseURL = (
    process.env.TEST_BASE_URL ?? 'https://localhost:3000'
  ).replace(/\/$/, '');

  // MP envía data.id como query param de la URL (que es lo que se firma en el manifest)
  await page.request
    .post(
      `${baseURL}/api/mercadopago?data.id=${encodeURIComponent(collectionId)}&type=payment`,
      {
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-request-id': requestId,
        },
        data: { data: { id: collectionId } },
      },
    )
    .catch(() => {});
}

export async function waitForPaidTicketConfirmation(page: Page) {
  const successMessage = page.getByText('¡Gracias por su compra!');
  const processingMessage = page.getByText('Procesando tu pago...');

  await expect(successMessage.or(processingMessage)).toBeVisible({
    timeout: 60_000,
  });

  if (await processingMessage.isVisible()) {
    // Disparar el webhook localmente si E2E_MOCK_MP_WEBHOOK=true
    await triggerWebhookIfMockEnabled(page);

    // Recargar periódicamente hasta que el webhook llegue y el estado cambie a PAID
    await expect
      .poll(
        async () => {
          await triggerWebhookIfMockEnabled(page);
          await page.reload();
          return successMessage
            .isVisible({ timeout: 5_000 })
            .catch(() => false);
        },
        {
          message:
            'El pago sigue en "Procesando" después de recargar.\n' +
            'En local: asegurate de tener E2E_MOCK_MP_WEBHOOK=true en .env.\n' +
            'En servidor público: el webhook de MP debería llegar automáticamente.\n' +
            'Si usás credenciales de prueba con servidor público, podés activar\n' +
            'E2E_MOCK_MP_WEBHOOK=true para que el test dispare el webhook manualmente.',
          intervals: [3_000, 5_000, 5_000, 10_000, 10_000, 15_000, 20_000],
          timeout: 120_000,
        },
      )
      .toBe(true);
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
