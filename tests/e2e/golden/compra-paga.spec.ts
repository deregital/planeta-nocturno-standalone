// Compra paga con Mercado Pago desde el celular: evento → elegir → checkout →
// pagar → entradas en pantalla y por mail. Es donde entra la plata: en los
// últimos 60 días hubo ~490 checkouts pagos (Vita, Misa, Egresas).
import {
  elegirEntradas,
  expect,
  sinDesbordes,
  test,
} from '@tests/e2e/support/fixtures';
import { completarCheckout, esperarMails } from '@tests/e2e/support/flows';
import {
  mailsTo,
  newPerson,
  query,
  seedEvent,
  tenantUrl,
} from '@tests/e2e/support/stack';

test('compra paga con Mercado Pago', async ({ celular: page }) => {
  const event = seedEvent('fiesta-paga');
  const buyer = newPerson('Paga');

  await page.goto(`${tenantUrl()}/event/${event.slug}`);
  await expect(page.getByRole('heading', { name: event.name })).toBeVisible();
  await sinDesbordes(page, 'la página del evento');
  await elegirEntradas(page, 'General', 2);
  await page.getByRole('button', { name: 'CONTINUAR' }).click();

  await expect(page).toHaveURL(/\/checkout/);
  // 2 × $5.000 + 10% de cargo por servicio, visible antes de pagar.
  await expect(page.getByText('$11.000')).toBeVisible({ timeout: 30_000 });
  await sinDesbordes(page, 'el checkout');
  await completarCheckout(page, buyer, {
    '¿Cómo te enteraste de la fiesta? *': 'Por una amiga',
  });
  await page.getByRole('button', { name: 'COMPRAR' }).click();

  await expect(page).toHaveURL(/mercadopago\.mock\.test\/checkout/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Total: $ 11000')).toBeVisible();
  await page.getByRole('button', { name: 'Pagar (aprobado)' }).click();

  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText('¡Ya podés descargar tus tickets!')).toBeVisible({
    timeout: 30_000,
  });
  await sinDesbordes(page, 'la página de entradas');
  const groupId = page.url().match(/\/tickets\/([0-9a-f-]{36})/)![1];

  const [group] = await query<{ status: string; tickets: string }>(
    `SELECT g.status, (SELECT count(*) FROM "emittedTicket" t WHERE t."ticketGroupId" = g.id) AS tickets
       FROM "ticketGroup" g WHERE g.id = $1`,
    [groupId],
  );
  expect(group).toEqual({ status: 'PAID', tickets: '2' });

  // Un mail por entrada, cada uno con su PDF; ni uno menos ni repetidos.
  const mails = await esperarMails(buyer.email, 2);
  await page.waitForTimeout(2_000);
  expect(await mailsTo(buyer.email)).toHaveLength(2);
  for (const mail of mails) {
    expect(mail.subject).toContain(event.name);
    expect(
      mail.attachments.filter((name) => name.endsWith('.pdf')),
    ).toHaveLength(1);
  }
});
