// Entradas gratis desde el celular, con datos de cada persona: cada una recibe
// la suya por mail. En los últimos 60 días hubo ~13.800 checkouts gratis en 12
// productoras (invitaciones, listas, cumpleaños).
import {
  elegirEntradas,
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
  tenantUrl,
} from '@tests/e2e/support/stack';

test('entradas gratis con los datos de cada persona', async ({
  celular: page,
}) => {
  const event = seedEvent('gratis');
  const ana = newPerson('Ana');
  const beto = newPerson('Beto');

  await page.goto(`${tenantUrl()}/event/${event.slug}`);
  await elegirEntradas(page, 'Entrada libre', 2);
  await page.getByRole('button', { name: 'CONTINUAR' }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await completarCheckout(page, [ana, beto]);
  await sinDesbordes(page, 'el checkout con dos entradas');
  await page.getByRole('button', { name: 'ADQUIRIR' }).click();

  const groupId = await verEntradas(page, 2);
  await sinDesbordes(page, 'la página con dos entradas');
  const tickets = await query<{ dni: string; mail: string }>(
    'SELECT dni, mail FROM "emittedTicket" WHERE "ticketGroupId" = $1 ORDER BY dni',
    [groupId],
  );
  expect(tickets.map((t) => t.dni).sort()).toEqual([ana.dni, beto.dni].sort());

  // Cada una recibe su entrada.
  for (const person of [ana, beto]) {
    const mails = await esperarMails(person.email);
    expect(mails).toHaveLength(1);
    expect(
      mails[0].attachments.filter((file) => file.endsWith('.pdf')),
    ).toHaveLength(1);
  }

  // Y las puede bajar desde la pantalla: un PDF por entrada.
  const bajadas: string[] = [];
  page.on('download', (download) => bajadas.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Descargar todos' }).click();
  await expect.poll(() => bajadas.length, { timeout: 30_000 }).toBe(2);
  expect(bajadas.every((file) => file.endsWith('.pdf'))).toBe(true);
});
