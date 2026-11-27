// Fixtures de los tests e2e. Cada persona del test (comprador, admin, puerta)
// abre su propio navegador aislado con `abrir('celular' | 'escritorio')`, como
// en la vida real. Al terminar, el test falla si alguna página tiró una
// excepción o un 5xx que no esté en la lista de problemas conocidos.
import { readFileSync } from 'node:fs';

import { test as base, devices, expect, type Page } from '@playwright/test';
import {
  CONTEXT_DEFAULTS,
  deviceOptions,
  FAKE_CAMERA,
  ignored,
} from '@tests/stack/browser-env.mjs';

import { seed, tenantUrl, type TenantKey } from '@tests/e2e/support/stack';

export { expect };

type Kind = 'celular' | 'escritorio' | 'instagram';

// Errores que ya se sabe que existen: se anotan en el reporte pero no frenan el
// test. Sacar de acá cuando se arreglen, así pasan a ser bloqueantes.
const KNOWN: { pattern: RegExp; note: string }[] = [
  {
    pattern:
      /Minified React error #41[89]|react\.dev\/errors\/41[89]|Hydration failed/i,
    note: 'Error de hidratación de React (#418/#419): en PostHog aparece en el 82–95% de los checkouts',
  },
];

type Problem = { page: string; kind: string; text: string };

type Fixtures = {
  abrir: (kind: Kind) => Promise<Page>;
  celular: Page;
  escritorio: Page;
};

export const test = base.extend<Fixtures>({
  abrir: async ({ browser }, use, testInfo) => {
    const opened: { name: string; close: () => Promise<void> }[] = [];
    const problems: Problem[] = [];
    const consoleErrors: string[] = [];
    const known = new Set<string>();

    await use(async (kind) => {
      const context = await browser.newContext({
        ...deviceOptions(
          devices,
          kind === 'escritorio'
            ? 'desktop'
            : kind === 'instagram'
              ? 'instagram'
              : 'mobile',
        ),
        ...CONTEXT_DEFAULTS,
        acceptDownloads: true,
      });
      await context.addInitScript(FAKE_CAMERA);
      const name = `${kind}-${opened.length + 1}`;
      const report = (kindOf: string, text: string) => {
        const match = KNOWN.find((entry) => entry.pattern.test(text));
        if (match) known.add(match.note);
        else
          problems.push({ page: name, kind: kindOf, text: text.slice(0, 800) });
      };
      context.on('page', (p) => {
        p.on('pageerror', (error) =>
          report('excepción', String(error.stack ?? error)),
        );
        p.on('console', (msg) => {
          if (
            msg.type() !== 'error' ||
            ignored(msg.text()) ||
            ignored(msg.location()?.url ?? '')
          )
            return;
          if (KNOWN.some((entry) => entry.pattern.test(msg.text()))) {
            report('consola', msg.text());
            return;
          }
          consoleErrors.push(
            `[${name}] ${msg.text().slice(0, 400)} (${msg.location()?.url ?? ''})`,
          );
        });
        p.on('response', (response) => {
          if (response.status() >= 500 && !ignored(response.url())) {
            report(
              'servidor',
              `${response.request().method()} ${response.url()} → ${response.status()}`,
            );
          }
        });
      });
      const page = await context.newPage();
      opened.push({ name, close: () => context.close() });
      return page;
    });

    for (const entry of opened) await entry.close().catch(() => {});
    for (const note of known)
      testInfo.annotations.push({ type: 'conocido', description: note });
    if (consoleErrors.length) {
      await testInfo.attach('errores de consola', {
        body: consoleErrors.join('\n'),
        contentType: 'text/plain',
      });
    }
    if (problems.length) {
      throw new Error(
        `Errores en el navegador:\n${problems.map((p) => `  [${p.page}] ${p.kind}: ${p.text}`).join('\n')}`,
      );
    }
  },
  celular: async ({ abrir }, use) => use(await abrir('celular')),
  escritorio: async ({ abrir }, use) => use(await abrir('escritorio')),
});

// ── Acciones comunes ─────────────────────────────────────────────────────────
export async function entrar(
  page: Page,
  username: string,
  tenant: TenantKey = 'prueba',
) {
  await page.goto(`${tenantUrl(tenant)}/login`);
  await page.getByPlaceholder('Nombre de usuario').fill(username);
  await page.getByPlaceholder('Contraseña').fill(seed().password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

// Nada más ancho que la pantalla del celular (un desborde horizontal deja la
// página corrida y botones fuera de vista).
export async function sinDesbordes(page: Page, donde: string) {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    if (scroll <= width + 1) return null;
    const culprits = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > width + 1)
      .slice(0, 3)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`,
      );
    return { width, scroll, culprits };
  });
  expect(
    overflow,
    `desborde horizontal en ${donde}: ${JSON.stringify(overflow)}`,
  ).toBeNull();
}

// Lo que "ve" la cámara falsa del scanner (un PNG con el QR).
export async function camara(page: Page, file: string | null) {
  const dataUrl = file
    ? `data:image/png;base64,${readFileSync(file).toString('base64')}`
    : null;
  await page.evaluate((url) => {
    const cam = (
      window as unknown as {
        __fakeCam: { show(u: string): void; blank(): void };
      }
    ).__fakeCam;
    if (url) cam.show(url);
    else cam.blank();
  }, dataUrl);
}

// Elige la cantidad de un tipo de entrada en la página del evento.
export async function elegirEntradas(
  page: Page,
  ticketName: string,
  cantidad: number,
) {
  const row = page
    .getByText(ticketName, { exact: true })
    .first()
    .locator('xpath=ancestor::div[.//button[@role="combobox"]][1]');
  await row.getByRole('combobox').click();
  await page
    .getByRole('option', { name: String(cantidad), exact: true })
    .click();
}

// Escribe en un buscador hasta que aparezca lo esperado: si la página todavía
// no terminó de hidratar, lo tipeado no filtra y hay que volver a escribirlo.
export async function buscar(
  page: Page,
  campo: ReturnType<Page['getByRole']>,
  texto: string,
  esperado: string,
) {
  await expect(async () => {
    await campo.fill('');
    await campo.fill(texto);
    await expect(page.getByText(esperado).first()).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 30_000 });
}
