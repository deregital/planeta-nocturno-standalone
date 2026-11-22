// Reglas del botón de arrepentimiento: plazo, 24 h antes del evento, entradas
// usadas, el link cifrado del mail y la cuenta para la devolución.
//   npm run test:withdrawal
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createWithdrawalToken,
  getIneligibleReason,
  lastMomentToWithdraw,
  normalizeWithdrawalDni,
  readWithdrawalToken,
  withdrawalDeadline,
} from '@/server/services/withdrawal';
import { parseRefundAccount } from '@/lib/withdrawal';

// La clave del link se lee recién al cifrar.
process.env.AUTH_SECRET ??= 'test-secret-for-withdrawal-links';

const NOW = new Date('2026-11-19T15:00:00-03:00');
const HOUR = 60 * 60 * 1000;

const base = {
  status: 'PAID' as const,
  paymentMethod: 'MERCADO_PAGO' as const,
  amount: 11000,
  anyScanned: false,
  eventStartingDate: new Date(NOW.getTime() + 72 * HOUR).toISOString(),
  purchasedAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
};

test('una compra paga, sin usar y en plazo se puede arrepentir', () => {
  assert.equal(getIneligibleReason(base, NOW), null);
});

test('las invitaciones y entradas sin cargo no aplican', () => {
  assert.equal(getIneligibleReason({ ...base, status: 'FREE' }, NOW), 'free');
  assert.equal(getIneligibleReason({ ...base, amount: 0 }, NOW), 'free');
});

test('lo cobrado en la boletería no aplica', () => {
  assert.equal(
    getIneligibleReason({ ...base, paymentMethod: 'ON_SITE' }, NOW),
    'on_site',
  );
});

test('una entrada escaneada frena el arrepentimiento', () => {
  assert.equal(getIneligibleReason({ ...base, anyScanned: true }, NOW), 'used');
});

test('hace falta pedirlo al menos 24 horas antes del evento', () => {
  const in23h = new Date(NOW.getTime() + 23 * HOUR).toISOString();
  const in25h = new Date(NOW.getTime() + 25 * HOUR).toISOString();
  const started = new Date(NOW.getTime() - HOUR).toISOString();
  assert.equal(
    getIneligibleReason({ ...base, eventStartingDate: in23h }, NOW),
    'too_close',
  );
  assert.equal(
    getIneligibleReason({ ...base, eventStartingDate: in25h }, NOW),
    null,
  );
  assert.equal(
    getIneligibleReason({ ...base, eventStartingDate: started }, NOW),
    'event_started',
  );
  assert.equal(
    getIneligibleReason({ ...base, eventStartingDate: null }, NOW),
    null,
  );
});

test('el plazo son 10 días corridos hasta el final del décimo día', () => {
  // Compra a las 23:30 del 9/11 (hora argentina): vale todo el 19/11.
  const purchasedAt = new Date('2026-11-09T23:30:00-03:00');
  assert.equal(
    withdrawalDeadline(purchasedAt).toISOString(),
    new Date('2026-11-19T23:59:59.999-03:00').toISOString(),
  );
  const purchase = {
    ...base,
    eventStartingDate: null,
    purchasedAt: purchasedAt.toISOString(),
  };
  assert.equal(
    getIneligibleReason(purchase, new Date('2026-11-19T23:59:00-03:00')),
    null,
  );
  assert.equal(
    getIneligibleReason(purchase, new Date('2026-11-20T00:00:01-03:00')),
    'expired',
  );
});

test('la fecha que ve el comprador es lo que vence primero', () => {
  const purchasedAt = new Date('2026-11-19T20:50:00-03:00');
  // El evento es antes de los 10 días: vale hasta 24 h antes.
  assert.equal(
    lastMomentToWithdraw(purchasedAt, '2026-11-29T23:27:00.000Z').toISOString(),
    '2026-11-28T23:27:00.000Z',
  );
  // El evento es mucho después: vencen los 10 días.
  assert.equal(
    lastMomentToWithdraw(purchasedAt, '2027-01-15T23:00:00.000Z').toISOString(),
    new Date('2026-11-29T23:59:59.999-03:00').toISOString(),
  );
});

test('el DNI se compara sin puntos ni espacios', () => {
  assert.equal(normalizeWithdrawalDni(' 12.345.678 '), '12345678');
  assert.equal(normalizeWithdrawalDni('aa-123 456'), 'AA123456');
});

test('el link del mail no muestra el mail ni el DNI y vence en 24 h', () => {
  const now = Date.now();
  const token = createWithdrawalToken(
    { mail: 'Compra@Ejemplo.com ', dni: '12.345.678' },
    'prueba',
    now,
  );
  assert.ok(!token.includes('ejemplo'));
  assert.ok(!Buffer.from(token, 'base64url').toString().includes('12345678'));

  const access = readWithdrawalToken(token, 'prueba', now + 23 * HOUR);
  assert.equal(access?.mail, 'compra@ejemplo.com');
  assert.equal(access?.dni, '12345678');

  assert.equal(readWithdrawalToken(token, 'prueba', now + 25 * HOUR), null);
  assert.equal(readWithdrawalToken(token, 'otra', now), null);
  assert.equal(readWithdrawalToken(`${token}x`, 'prueba', now), null);
  const tampered = Buffer.from(token, 'base64url');
  tampered[20] ^= 1;
  assert.equal(
    readWithdrawalToken(tampered.toString('base64url'), 'prueba', now),
    null,
  );
});

test('la cuenta para la devolución: CBU o CVU con verificadores, o alias', () => {
  // CBU válido (con espacios, como suele copiarse).
  assert.deepEqual(parseRefundAccount(' 2850590940 090418135201 '), {
    ok: true,
    account: { kind: 'cbu', value: '2850590940090418135201' },
  });
  // Un número cambiado no pasa el dígito verificador.
  const typo = parseRefundAccount('2850590940090418135202');
  assert.equal(typo.ok, false);
  assert.match(!typo.ok ? typo.error : '', /no coincide/);
  // Le falta un número.
  const short = parseRefundAccount('285059094009041813520');
  assert.match(!short.ok ? short.error : '', /22 números \(ingresaste 21\)/);
  // Alias: se guarda en mayúsculas.
  assert.deepEqual(parseRefundAccount('lucia.compra.mp'), {
    ok: true,
    account: { kind: 'alias', value: 'LUCIA.COMPRA.MP' },
  });
  assert.equal(parseRefundAccount('mi alias').ok, false);
  assert.equal(parseRefundAccount('corto').ok, false);
  assert.equal(parseRefundAccount('').ok, false);
});
