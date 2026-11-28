// Cuenta regresiva de la reserva en el checkout: formato y cuándo cambia de
// etapa (normal, últimos 2 minutos en rojo, vencida).
//   npm run test:hold-countdown
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatHoldRemaining,
  HOLD_ENDING_MS,
  holdPhase,
} from '@/lib/hold-countdown';

const MIN = 60 * 1000;

test('muestra minutos y segundos, redondeando hacia arriba', () => {
  assert.equal(formatHoldRemaining(10 * MIN), '10:00');
  assert.equal(formatHoldRemaining(9 * MIN + 41_000), '09:41');
  // A 400 ms de vencer todavía no dice 00:00.
  assert.equal(formatHoldRemaining(400), '00:01');
  assert.equal(formatHoldRemaining(0), '00:00');
  assert.equal(formatHoldRemaining(-5_000), '00:00');
});

test('desde una hora agrega las horas (reservas de Mercado Pago)', () => {
  assert.equal(formatHoldRemaining(65 * MIN + 3_000), '1:05:03');
});

test('se pone en rojo en los últimos 2 minutos y vence en 0', () => {
  assert.equal(holdPhase(10 * MIN), 'running');
  assert.equal(holdPhase(HOLD_ENDING_MS + 1), 'running');
  assert.equal(holdPhase(HOLD_ENDING_MS), 'ending');
  assert.equal(holdPhase(1), 'ending');
  assert.equal(holdPhase(0), 'expired');
  assert.equal(holdPhase(-1), 'expired');
});
