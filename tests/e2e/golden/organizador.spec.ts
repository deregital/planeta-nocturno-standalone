// Organizadores desde el celular: comparten su invitación o su link de venta,
// la gente entra por ahí y la venta les queda atribuida. En los últimos 60 días
// 853 organizadores de 10 productoras usaron su panel (94% desde el celular).
import {
  buscar,
  elegirEntradas,
  entrar,
  expect,
  sinDesbordes,
  test,
} from '@tests/e2e/support/fixtures';
import { completarCheckout, esperarMails } from '@tests/e2e/support/flows';
import {
  newPerson,
  query,
  seedEvent,
  seedUser,
  tenantUrl,
} from '@tests/e2e/support/stack';

async function organizerId(username: string) {
  const [row] = await query<{ id: string; code: string }>(
    'SELECT id, code FROM "user" WHERE name = $1',
    [username],
  );
  return row;
}

test('el organizador comparte una invitación y el invitado la canjea', async ({
  abrir,
}) => {
  const event = seedEvent('egresados');
  // El organizador con más códigos sin usar (cada corrida gasta uno).
  const [conCodigos] = await query<{ name: string; id: string }>(
    `SELECT u.name, u.id FROM "ticketXOrganizer" x JOIN "user" u ON u.id = x."organizerId"
      WHERE x."eventId" = $1 AND x."ticketId" IS NULL AND u.role = 'ORGANIZER'
      GROUP BY u.name, u.id ORDER BY count(*) DESC LIMIT 1`,
    [event.id],
  );
  // Falla en vez de saltearse: un golden path salteado pasa desapercibido.
  expect(
    conCodigos,
    'No quedan códigos de invitación sin usar: tests/stack/up.sh --reseed',
  ).toBeTruthy();
  const orga = await abrir('celular');
  await orga
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: tenantUrl(),
    });

  await entrar(orga, conCodigos.name);
  await orga.goto(`${tenantUrl()}/organization/event/${event.slug}`);
  await expect(
    orga.getByRole('heading', { name: 'Códigos de invitación' }),
  ).toBeVisible();
  await sinDesbordes(orga, 'el panel del organizador');
  await orga
    .getByRole('button', { name: /^Copiar ticket/ })
    .first()
    .click();
  await expect(orga.getByText('Enlace copiado al portapapeles')).toBeVisible();
  const link = await orga.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(
    new RegExp(`/event/${event.slug}\\?invite=[A-Z0-9]{6}$`),
  );
  const code = link.split('invite=')[1];

  const invitada = newPerson('Invitada');
  const celular = await abrir('celular');
  await celular.goto(link);
  await expect(celular).toHaveURL(/\/checkout/, { timeout: 30_000 });
  await completarCheckout(celular, invitada);
  await celular.getByRole('button', { name: 'ADQUIRIR' }).click();
  await expect(
    celular.getByText('¡Ya podés descargar tus tickets!'),
  ).toBeVisible({ timeout: 30_000 });
  await esperarMails(invitada.email);

  const [canje] = await query<{ used: boolean; invitedById: string | null }>(
    `SELECT x."ticketId" IS NOT NULL AS used, g."invitedById"
       FROM "ticketXOrganizer" x
       LEFT JOIN "emittedTicket" t ON t.id = x."ticketId"
       LEFT JOIN "ticketGroup" g ON g.id = t."ticketGroupId"
      WHERE x."eventId" = $1 AND x.code = $2`,
    [event.id, code],
  );
  expect(canje).toEqual({ used: true, invitedById: conCodigos.id });

  // El organizador la ve en su lista de ventas y el código ya no está para compartir.
  await orga.reload();
  await buscar(
    orga,
    orga.getByRole('textbox', { name: /Buscar por ID, nombre, DNI/ }).first(),
    invitada.dni,
    invitada.fullName,
  );
  await expect(orga.getByRole('cell', { name: code, exact: true })).toHaveCount(
    0,
  );

  // El mismo link otra vez no da otra entrada.
  const otra = await abrir('celular');
  await otra.goto(link);
  await expect(otra.getByText('Código ya utilizado')).toBeVisible({
    timeout: 30_000,
  });
});

test('una compra por el link de un organizador le queda atribuida', async ({
  abrir,
}) => {
  const event = seedEvent('fiesta-paga');
  const orga1 = await organizerId('orga1');
  const comprador = newPerson('Linkorga');

  const page = await abrir('celular');
  await page.goto(`${tenantUrl()}/event/${event.slug}?organizer=${orga1.code}`);
  await elegirEntradas(page, 'General', 1);
  await page.getByRole('button', { name: 'CONTINUAR' }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await completarCheckout(page, comprador, {
    '¿Cómo te enteraste de la fiesta? *': 'Por un organizador',
  });
  await page.getByRole('button', { name: 'COMPRAR' }).click();
  await expect(page).toHaveURL(/mercadopago\.mock\.test\/checkout/, {
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Pagar (aprobado)' }).click();
  await expect(page.getByText('¡Ya podés descargar tus tickets!')).toBeVisible({
    timeout: 30_000,
  });
  const groupId = page.url().match(/\/tickets\/([0-9a-f-]{36})/)![1];

  const [group] = await query<{
    status: string;
    invitedById: string | null;
    totalAmount: string;
  }>(
    'SELECT status, "invitedById", "totalAmount" FROM "ticketGroup" WHERE id = $1',
    [groupId],
  );
  expect(group.status).toBe('PAID');
  expect(group.invitedById, 'la venta queda a nombre del organizador').toBe(
    orga1.id,
  );
  // orga1 tiene 20% de descuento en este evento: $5.000 → $4.000 (+ 10% de servicio).
  expect(Number(group.totalAmount)).toBeLessThan(5_500);

  const orga = await abrir('celular');
  await entrar(orga, seedUser('orga1').username);
  await orga.goto(`${tenantUrl()}/organization/event/${event.slug}`);
  await buscar(
    orga,
    orga.getByRole('textbox', { name: /Buscar por ID, nombre, DNI/ }).first(),
    comprador.dni,
    comprador.fullName,
  );
});
