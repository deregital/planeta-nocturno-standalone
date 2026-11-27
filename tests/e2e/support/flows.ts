// Pasos del público que se repiten entre tests: completar el checkout y
// esperar los mails.
import { expect, type Page } from '@playwright/test';

import { mailsTo, type Mail, type Person } from '@tests/e2e/support/stack';

// Completa los datos del comprador (o de cada entrada, si el evento los pide
// por entrada) y las preguntas obligatorias del evento.
export async function completarCheckout(
  page: Page,
  people: Person | Person[],
  respuestas: Record<string, string> = {},
) {
  const list = Array.isArray(people) ? people : [people];
  const nombre = page.getByRole('textbox', { name: 'Nombre y apellido *' });
  await expect(nombre.first()).toBeVisible({ timeout: 30_000 });
  for (const [i, person] of list.entries()) {
    await nombre.nth(i).fill(person.fullName);
    await page
      .getByRole('textbox', { name: 'Mail *' })
      .nth(i)
      .fill(person.email);
    await page
      .getByRole('textbox', { name: 'DNI/Pasaporte *' })
      .nth(i)
      .fill(person.dni);
    await page.locator('input[type="tel"]').nth(i).fill(person.phone);
    await page
      .getByRole('textbox', { name: 'Día' })
      .nth(i)
      .fill(person.birth.day);
    await page
      .getByRole('textbox', { name: 'Mes' })
      .nth(i)
      .fill(person.birth.month);
    await page
      .getByRole('textbox', { name: 'Año' })
      .nth(i)
      .fill(person.birth.year);
    // Los géneros ya elegidos dejan de decir "Selecciona tu género".
    await page
      .getByRole('combobox')
      .filter({ hasText: 'Selecciona tu género' })
      .first()
      .click();
    await page.getByRole('option', { name: 'Femenino' }).click();
  }
  for (const [pregunta, respuesta] of Object.entries(respuestas)) {
    await page.getByRole('textbox', { name: pregunta }).first().fill(respuesta);
  }
  // Sin aceptar Términos y Política el checkout no emite.
  await page.getByRole('checkbox', { name: /Acepto los Términos/ }).check();
}

// La página de entradas después de pagar o canjear: "Tu ticket" o "Tus N
// tickets", con un PDF para bajar por entrada. Devuelve el id del grupo.
export async function verEntradas(page: Page, cantidad = 1): Promise<string> {
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const titulo = cantidad > 1 ? `Tus ${cantidad} tickets` : 'Tu ticket';
  await expect(
    page.getByRole('heading', { level: 1, name: titulo }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Descargar PDF' })).toHaveCount(
    cantidad,
  );
  return page.url().match(/\/tickets\/([0-9a-f-]{36})/)![1];
}

// Espera a que lleguen `count` mails a la dirección y los devuelve.
export async function esperarMails(
  address: string,
  count = 1,
  timeout = 30_000,
): Promise<Mail[]> {
  let mails: Mail[] = [];
  await expect
    .poll(async () => (mails = await mailsTo(address)).length, {
      timeout,
      message: `mails a ${address}`,
    })
    .toBeGreaterThanOrEqual(count);
  return mails;
}
