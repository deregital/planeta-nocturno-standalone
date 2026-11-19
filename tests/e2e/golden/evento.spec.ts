// La productora arma su evento: lo crea con una entrada paga y una gratis, lo
// publica, le cambia el precio, y el público lo ve y saca entrada. En los
// últimos 60 días 38 productoras entraron a su lista de eventos, 20 editaron y
// 15 crearon alguno.
import type { Page } from '@playwright/test';

import path from 'node:path';

import {
  elegirEntradas,
  entrar,
  expect,
  sinDesbordes,
  test,
} from '@tests/e2e/support/fixtures';
import {
  completarCheckout,
  esperarMails,
  verEntradas,
} from '@tests/e2e/support/flows';
import { newPerson, query, tenantUrl } from '@tests/e2e/support/stack';

const FLYER = path.join(process.cwd(), 'public', 'Foto.png');

function localDateTime(daysAhead: number, hour: number) {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

async function crearTicket(
  page: Page,
  tipo: 'Pago' | 'Free',
  datos: { nombre: string; precio?: number; cupo: number },
) {
  await page.getByRole('button', { name: tipo, exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: `Crear ticket de tipo ${tipo}`,
  });
  await dialog
    .getByRole('textbox', { name: 'Nombre del ticket *' })
    .fill(datos.nombre);
  await dialog
    .getByRole('textbox', { name: 'Descripción del ticket *' })
    .fill(`Entrada ${datos.nombre}`);
  if (datos.precio !== undefined) {
    await dialog
      .getByRole('spinbutton', { name: 'Precio del ticket ($)' })
      .fill(String(datos.precio));
  }
  await dialog
    .getByRole('spinbutton', { name: 'Cantidad maxima de tickets *' })
    .fill(String(datos.cupo));
  await dialog.getByRole('button', { name: 'Crear' }).click();
  await expect(dialog).toBeHidden();
}

test('la productora crea, publica y edita un evento, y el público saca entrada', async ({
  abrir,
}) => {
  const admin = await abrir('escritorio');
  const name = `Golden ${Date.now().toString().slice(-6)}`;

  await entrar(admin, 'admin');
  await admin.goto(`${tenantUrl()}/admin/event/create`);
  // Si la página todavía no terminó de hidratar, la subida no abre el recorte: se reintenta.
  const recorte = admin.getByRole('dialog', { name: 'Recortar portada' });
  await expect(async () => {
    await admin.locator('input[type="file"]').first().setInputFiles(FLYER);
    await expect(recorte).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await recorte.getByRole('button', { name: 'Usar recorte' }).click();
  await expect(
    admin.getByRole('button', { name: 'Cambiar imagen' }),
  ).toBeVisible({ timeout: 30_000 });
  await admin.getByRole('textbox', { name: 'Nombre *' }).fill(name);
  await admin
    .getByRole('textbox', { name: 'Descripción *' })
    .fill('Evento creado por el golden path.');
  await admin
    .getByRole('textbox', { name: 'Inicio' })
    .fill(localDateTime(30, 22));
  await admin
    .getByRole('textbox', { name: 'Finalización' })
    .fill(localDateTime(31, 5));
  await admin.getByRole('button', { name: 'Continuar' }).click();

  await admin.getByRole('button', { name: 'Tradicional' }).click();
  await crearTicket(admin, 'Pago', {
    nombre: 'Anticipada',
    precio: 8000,
    cupo: 100,
  });
  await crearTicket(admin, 'Free', { nombre: 'Lista', cupo: 50 });
  await admin.getByRole('button', { name: 'Continuar' }).click();
  await admin.getByRole('button', { name: 'Continuar' }).click(); // sin organizadores
  await expect(
    admin.getByRole('heading', { name: 'Previsualización del evento' }),
  ).toBeVisible();
  await admin.getByRole('button', { name: 'Crear y publicar' }).click();
  await expect(admin).toHaveURL(/\/admin\/event$/, { timeout: 30_000 });
  await expect(admin.getByText(name)).toBeVisible();

  const [created] = await query<{ slug: string; isActive: boolean }>(
    'SELECT slug, "isActive" FROM event WHERE name = $1',
    [name],
  );
  expect(created?.isActive).toBe(true);

  // El público lo ve en la cartelera y en su página, con los precios cargados.
  const publico = await abrir('celular');
  await publico.goto(tenantUrl());
  await expect(publico.getByText(name).first()).toBeVisible();
  await sinDesbordes(publico, 'la cartelera');
  await publico.goto(`${tenantUrl()}/event/${created.slug}`);
  await expect(publico.getByText('$8.000')).toBeVisible();
  await expect(publico.getByText('SIN CARGO')).toBeVisible();

  // La productora sube el precio y el público ve el nuevo.
  await admin.goto(`${tenantUrl()}/admin/event/edit/${created.slug}`);
  const fila = admin.getByRole('listitem').filter({ hasText: 'Anticipada' });
  await fila.getByRole('button').nth(1).click();
  const editar = admin.getByRole('dialog', {
    name: 'Editar ticket de tipo Pago',
  });
  await editar
    .getByRole('spinbutton', { name: 'Precio del ticket ($)' })
    .fill('9000');
  await editar.getByRole('button', { name: 'Editar' }).click();
  await expect(editar).toBeHidden();
  await admin.getByRole('button', { name: 'Actualizar' }).click();
  await expect(admin).toHaveURL(/\/admin\/event$/, { timeout: 30_000 });

  await publico.reload();
  await expect(publico.getByText('$9.000')).toBeVisible();

  // Y alguien saca una entrada gratis del evento recién creado.
  const persona = newPerson('Lista');
  await elegirEntradas(publico, 'Lista', 1);
  await publico.getByRole('button', { name: 'CONTINUAR' }).click();
  await completarCheckout(publico, persona);
  await publico.getByRole('button', { name: 'ADQUIRIR' }).click();
  await verEntradas(publico);
  const [mail] = await esperarMails(persona.email);
  expect(mail.subject).toContain(name);
  expect(mail.attachments.filter((file) => file.endsWith('.pdf'))).toHaveLength(
    1,
  );
});
