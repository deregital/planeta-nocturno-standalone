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
import {
  completarCheckout,
  esperarMails,
  verEntradas,
} from '@tests/e2e/support/flows';
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
  // El organizador con más códigos sin compartir (cada corrida comparte uno).
  const [conCodigos] = await query<{ name: string; id: string }>(
    `SELECT u.name, u.id FROM "ticketXOrganizer" x JOIN "user" u ON u.id = x."organizerId"
      WHERE x."eventId" = $1 AND x."ticketId" IS NULL AND NOT x.shared AND u.role = 'ORGANIZER'
      GROUP BY u.name, u.id ORDER BY count(*) DESC LIMIT 1`,
    [event.id],
  );
  // Falla en vez de saltearse: un golden path salteado pasa desapercibido.
  expect(
    conCodigos,
    'No quedan códigos de invitación sin compartir: tests/stack/up.sh --reseed',
  ).toBeTruthy();
  const invitada = newPerson('Invitada');
  const orga = await abrir('celular');
  // El menú de compartir del celular: se queda con lo que se compartió.
  await orga.addInitScript(() => {
    const w = window as unknown as { __compartido?: string };
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        w.__compartido = data.url;
      },
    });
  });

  await entrar(orga, conCodigos.name);
  await orga.goto(`${tenantUrl()}/organization/event/${event.slug}`);
  await expect(
    orga.getByRole('heading', { name: 'Códigos de invitación' }),
  ).toBeVisible();
  await sinDesbordes(orga, 'el panel del organizador');
  await orga
    .getByRole('button', { name: 'Compartir', exact: true })
    .first()
    .click();
  const cajon = orga.getByRole('dialog');
  await expect(
    cajon.getByText('Cada enlace sirve para una sola persona.'),
  ).toBeVisible();
  await sinDesbordes(orga, 'el cajón para compartir');
  await cajon
    .getByRole('textbox', { name: 'Para quién es' })
    .fill(invitada.fullName);
  await cajon.getByRole('button', { name: 'Compartir' }).click();
  await expect(cajon).toBeHidden();
  const link = await orga.evaluate(
    () => (window as unknown as { __compartido?: string }).__compartido,
  );
  expect(link).toMatch(
    new RegExp(`/event/${event.slug}\\?invite=[A-Z0-9]{6}$`),
  );
  const code = link!.split('invite=')[1];
  // Queda marcado como compartido y con el nombre, en la base y en su lista.
  await expect
    .poll(async () =>
      query<{ shared: boolean; sharedWith: string | null }>(
        'SELECT shared, "sharedWith" FROM "ticketXOrganizer" WHERE "eventId" = $1 AND code = $2',
        [event.id, code],
      ),
    )
    .toEqual([{ shared: true, sharedWith: invitada.fullName }]);
  await orga.getByRole('tab', { name: /^Compartidos/ }).click();
  await expect(orga.getByText(invitada.fullName).first()).toBeVisible();

  const celular = await abrir('celular');
  await celular.goto(link!);
  await expect(celular).toHaveURL(/\/checkout/, { timeout: 30_000 });
  await completarCheckout(celular, invitada);
  await celular.getByRole('button', { name: 'ADQUIRIR' }).click();
  await verEntradas(celular);
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

  // El organizador la ve en su lista de ventas.
  await orga.reload();
  await buscar(
    orga,
    orga.getByRole('textbox', { name: /Buscar por ID, nombre, DNI/ }).first(),
    invitada.dni,
    invitada.fullName,
  );

  // El mismo link otra vez no da otra entrada: pide el DNI del titular, y sólo
  // con ese DNI muestra la entrada que ya tiene.
  const otra = await abrir('celular');
  await otra.goto(link!);
  await expect(otra).toHaveURL(/\/ticket\?invite=/, { timeout: 30_000 });
  await sinDesbordes(otra, 'la invitación ya usada');
  const dni = otra.getByLabel('DNI del titular');
  await dni.fill('40111222');
  await otra.getByRole('button', { name: 'Ver mi ticket' }).click();
  await expect(
    otra.getByText('El DNI no coincide con el del titular de esta invitación.'),
  ).toBeVisible();
  await dni.fill(invitada.dni);
  await otra.getByRole('button', { name: 'Ver mi ticket' }).click();
  await verEntradas(otra);
  const [entradas] = await query<{ n: string }>(
    'SELECT count(*) AS n FROM "emittedTicket" WHERE "eventId" = $1 AND dni = $2',
    [event.id, invitada.dni],
  );
  expect(entradas.n, 'una sola entrada por invitación').toBe('1');
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
  const groupId = await verEntradas(page);

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
