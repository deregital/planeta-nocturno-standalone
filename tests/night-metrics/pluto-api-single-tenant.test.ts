/**
 * Pedidos firmados de Pluto en una instancia de una sola productora: la
 * agenda vuelve con una productora sin slug y las métricas se piden con
 * `tenant: null`. Corre las rutas en el proceso, contra el Postgres de prueba
 * (LOAD_ADMIN_DATABASE_URL).
 *
 *   npm run test:night-metrics
 */
import '@tests/load/bootstrap';
import '@tests/night-metrics/env-single-tenant';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  createScenarioDatabase,
  openLoadDb,
  type LoadDb,
} from '@tests/load/lib/db';
import { insertEvent } from '@tests/load/lib/seed';
import { databaseUrl, signedRequest } from '@tests/night-metrics/pluto-helpers';
import { POST as agenda } from '@/app/api/pluto/agenda/route';
import { POST as nightMetrics } from '@/app/api/pluto/night-metrics/route';
import {
  PLUTO_AGENDA_ACTION,
  PLUTO_NIGHT_METRICS_ACTION,
} from '@/lib/pluto/instance-api';
import { getInstanceDb } from '@/server/instance/get-instance-db';

const START = new Date('2026-11-20T23:00:00.000Z');
const URL = 'https://unica.test';

let load: LoadDb;
let eventId: string;

before(async () => {
  const name = await createScenarioDatabase('pluto_single');
  process.env.DATABASE_URL = databaseUrl(name);
  load = await openLoadDb(name);
  ({ eventId } = await insertEvent(load.raw, {
    name: 'Noche de prueba',
    startingDate: START,
    ticketTypes: [{ name: 'Invitación', price: 0, maxAvailable: 100 }],
  }));
});

after(async () => {
  await load?.close();
  const db = await getInstanceDb({ url: process.env.DATABASE_URL! });
  await db.$client.end();
});

describe('Pedidos firmados de Pluto (una sola productora)', () => {
  it('la agenda trae la única productora, sin slug', async () => {
    const response = await agenda(
      signedRequest(`${URL}/api/pluto/agenda`, {
        action: PLUTO_AGENDA_ACTION,
        from: new Date(START.getTime() - 12 * 3_600_000).toISOString(),
        to: new Date(START.getTime() + 36 * 3_600_000).toISOString(),
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(body.instance.mode, 'single');
    assert.equal(body.instance.name, 'Productora única de prueba');
    assert.equal(body.tenants.length, 1);
    assert.equal(body.tenants[0].slug, null);
    assert.equal(body.tenants[0].url, URL);
    assert.deepEqual(
      body.tenants[0].events.map((event: { id: string }) => event.id),
      [eventId],
    );
    assert.deepEqual(body.failedTenants, []);
  });

  it('las métricas se piden sin productora; con una productora no existe', async () => {
    const response = await nightMetrics(
      signedRequest(`${URL}/api/pluto/night-metrics`, {
        action: PLUTO_NIGHT_METRICS_ACTION,
        events: [
          { tenant: null, eventId },
          { tenant: 'unica', eventId },
          { tenant: null, eventId: randomUUID() },
        ],
      }),
    );
    assert.equal(response.status, 200);
    const [found, wrongTenant, missing] = (await response.json()).results;

    assert.equal(found.metrics.event.id, eventId);
    assert.equal(found.metrics.tickets.valid, 0);
    assert.equal(wrongTenant.error, 'TENANT_NOT_FOUND');
    assert.equal(missing.error, 'EVENT_NOT_FOUND');
  });
});
