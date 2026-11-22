// La puerta: el usuario de control escanea QR reales (los del PDF) con la
// cámara del celular. En los últimos 60 días se escanearon ~2.400 entradas en
// 10 productoras; el 28/10 un celular de puerta se recargó 48 veces en una hora
// porque el scanner se trababa después de varios escaneos.
import type { Page } from '@playwright/test';

import {
  camara,
  entrar,
  expect,
  sinDesbordes,
  test,
} from '@tests/e2e/support/fixtures';
import { query, seed, seedEvent, tenantUrl } from '@tests/e2e/support/stack';

const event = () => seedEvent('en-curso');

async function abrirScanner(page: Page) {
  await entrar(page, 'puerta');
  await page.goto(`${tenantUrl()}/admin/event/${event().slug}/scan`);
  await expect(page.locator('video').first()).toBeVisible({ timeout: 30_000 });
  // Los eventos escanean en modo rápido salvo que alguien elija Normal: el
  // celular baja la lista y decide sin esperar al servidor.
  await expect(page.getByText(/Modo rápido · sincronizado/)).toBeVisible({
    timeout: 30_000,
  });
  await sinDesbordes(page, 'el scanner');
}

type Escaneo = { at: number; decidedBy?: 'server' | 'local' };

// El último resultado que mostró el scanner. Cada escaneo queda en el
// historial del celular, lo haya decidido el celular o el servidor.
function ultimoEscaneo(page: Page) {
  return page.evaluate((): Escaneo => {
    let last: Escaneo = { at: 0 };
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('pn-scanner-history:')) continue;
      const [item] = JSON.parse(localStorage.getItem(key) ?? '[]') as Escaneo[];
      if (item && item.at > last.at) last = item;
    }
    return last;
  });
}

// Muestra el QR y espera a que el scanner muestre el resultado. En modo rápido
// una entrada conocida se decide en el celular, sin pedido al servidor.
async function escanear(page: Page, file: string) {
  await camara(page, null);
  await page.waitForTimeout(300);
  const antes = (await ultimoEscaneo(page)).at;
  const started = Date.now();
  await camara(page, file);
  await expect
    .poll(async () => (await ultimoEscaneo(page)).at, { timeout: 15_000 })
    .toBeGreaterThan(antes);
  const ms = Date.now() - started;
  return { ms, decidedBy: (await ultimoEscaneo(page)).decidedBy };
}

test('escaneo en la puerta: válida, repetida, de otro evento, de otra productora y basura', async ({
  celular: page,
}) => {
  // Una de las primeras 20 entradas sembradas (las 20 siguientes son del test de
  // 30 escaneos). Cada corrida la deja escaneada, así que se vuelve a dejar sin
  // escanear para que el test se pueda repetir sin volver a sembrar.
  const qrs = seed().tenants.prueba.qr.enCurso;
  const valida = qrs[test.info().repeatEachIndex % 20];
  await query('DELETE FROM "emittedTicketScan" WHERE "emittedTicketId" = $1', [
    valida.emittedTicketId,
  ]);
  await query(
    'UPDATE "emittedTicket" SET scanned = false, "scannedAt" = NULL, "scannedByUserId" = NULL WHERE id = $1',
    [valida.emittedTicketId],
  );

  await abrirScanner(page);

  const { decidedBy } = await escanear(page, valida.file);
  expect(decidedBy, 'la entrada válida la decide el celular').toBe('local');
  await expect(page.getByText(valida.fullName).first()).toBeVisible();
  await expect(page.locator('.bg-green-500').first()).toBeVisible();
  // El ingreso se sube por detrás y queda registrado en la base.
  await expect(
    page.getByText('Escaneado en este celular · registrado'),
  ).toBeVisible({ timeout: 15_000 });
  const [scanned] = await query<{ scanned: boolean }>(
    'SELECT scanned FROM "emittedTicket" WHERE id = $1',
    [valida.emittedTicketId],
  );
  expect(scanned.scanned).toBe(true);

  // La misma entrada otra vez (pasados los 5 s en que el scanner ignora el mismo código).
  await camara(page, null);
  await page.waitForTimeout(5_500);
  await escanear(page, valida.file);
  await expect(page.getByText('Ticket ya escaneado').first()).toBeVisible();

  await escanear(page, seed().tenants.prueba.qr.masTarde[0].file);
  await expect(page.getByText('Entrada de otro evento').first()).toBeVisible();

  await escanear(page, seed().tenants.otra.qr.otra[0].file);
  await expect(page.getByText('Ticket no encontrado').first()).toBeVisible();

  await escanear(page, seed().junkQr);
  await expect(
    page.getByText(/no encontrado|inválid|no válid/i).first(),
  ).toBeVisible();
});

test('el scanner no se traba con 30 escaneos seguidos', async ({
  celular: page,
}) => {
  // Diez entradas distintas, tres vueltas: cada una vuelve después de los 5 s
  // en que el scanner ignora el mismo código.
  const qrs = seed().tenants.prueba.qr.enCurso.slice(20, 30);
  await abrirScanner(page);
  const tiempos: number[] = [];
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    for (const qr of qrs) tiempos.push((await escanear(page, qr.file)).ms);
  }
  test.info().annotations.push({
    type: 'tiempos',
    description: `de mostrar el QR al resultado en pantalla: mediana ${tiempos.toSorted((a, b) => a - b)[15]} ms, máximo ${Math.max(...tiempos)} ms`,
  });
  // Los últimos no pueden tardar mucho más que los primeros.
  const primeros = tiempos.slice(0, 10).toSorted((a, b) => a - b)[5];
  const ultimos = tiempos.slice(-10).toSorted((a, b) => a - b)[5];
  expect(
    ultimos,
    `mediana de los primeros 10: ${primeros} ms, de los últimos 10: ${ultimos} ms`,
  ).toBeLessThan(Math.max(primeros * 3, 2_500));
});
