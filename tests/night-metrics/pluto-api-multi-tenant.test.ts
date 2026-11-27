/**
 * Pedidos firmados de Pluto en una instancia multi-tenant: la agenda y las
 * métricas de la noche vuelven con todas las productoras activas, aunque el
 * pedido llegue por el dominio raíz. Corre las rutas en el proceso, contra el
 * Postgres de prueba (LOAD_ADMIN_DATABASE_URL), con Neon simulado.
 *
 *   npm run test:night-metrics
 */
import '@tests/load/bootstrap';
import '@tests/night-metrics/env-multi-tenant';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

import {
  activateTenantRecord,
  createTenantRecord,
} from '@tests/isolation/control-fixture';
import {
  createScenarioDatabase,
  openLoadDb,
  type LoadDb,
} from '@tests/load/lib/db';
import { insertEvent } from '@tests/load/lib/seed';
import {
  ADMIN_URL,
  databaseUrl,
  mockNeonApi,
  signedRequest,
} from '@tests/night-metrics/pluto-helpers';
import { POST as agenda } from '@/app/api/pluto/agenda/route';
import { POST as nightMetrics } from '@/app/api/pluto/night-metrics/route';
import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import {
  PLUTO_AGENDA_ACTION,
  PLUTO_NIGHT_METRICS_ACTION,
} from '@/lib/pluto/instance-api';
import { closeTenantDb } from '@/server/instance/get-instance-db';
import { getNightMetrics } from '@/server/services/nightMetrics';

const START = new Date('2026-11-20T23:00:00.000Z');
const RANGE = {
  from: new Date(START.getTime() - 12 * 3_600_000).toISOString(),
  to: new Date(START.getTime() + 36 * 3_600_000).toISOString(),
};
const ROOT = 'https://pn.test';

let alfa: LoadDb;
let beta: LoadDb;
let alfaEvent: string;
let betaEvent: string;
let betaLaterEvent: string;
let betaInvitationEvent: string;

async function adminQuery(sql: string) {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function addTenant(name: string, slug: string, databaseName: string) {
  const tenant = await createTenantRecord(name, slug);
  await activateTenantRecord(tenant.id, databaseName);
  return tenant;
}

async function seedNight(
  db: LoadDb,
  name: string,
  startingDate: Date,
  options: { invitation?: boolean } = {},
) {
  const { eventId, ticketTypeIds } = await insertEvent(db.raw, {
    name,
    startingDate,
    ticketTypes: [{ name: 'General', price: 10_000, maxAvailable: 100 }],
    // Las de invitación nunca se publican.
    ...(options.invitation
      ? { inviteCondition: 'INVITATION' as const, isActive: false }
      : {}),
  });
  const groupId = randomUUID();
  await db.raw.query(
    `INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id, "totalAmount", "paymentMethod")
     VALUES ($1, 'PAID', 2, $2, 20000, 'MERCADO_PAGO')`,
    [groupId, eventId],
  );
  for (const [index, scannedAt] of [
    new Date(startingDate.getTime() + 20 * 60_000).toISOString(),
    null,
  ].entries()) {
    await db.raw.query(
      `INSERT INTO "emittedTicket" ("fullName", dni, mail, gender, "phoneNumber", "birthDate",
         slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId", scanned, "scannedAt")
       VALUES ('Persona', $1, 'p@mail.test', 'male', '+5491155550000', '2000-01-01',
         $2, $3, $4, $5, $6, $7, $8)`,
      [
        `4000000${index}`,
        `entrada-${randomUUID().slice(0, 8)}`,
        ticketTypeIds[0],
        groupId,
        eventId,
        index + 1,
        scannedAt !== null,
        scannedAt,
      ],
    );
  }
  return eventId;
}

before(async () => {
  mockNeonApi();
  await adminQuery(
    'DROP DATABASE IF EXISTS pn_night_metrics_control WITH (FORCE)',
  );
  await adminQuery('CREATE DATABASE pn_night_metrics_control');
  const control = new Client({
    connectionString: databaseUrl('pn_night_metrics_control'),
  });
  await control.connect();
  await migrate(drizzle(control), { migrationsFolder: 'drizzle/control' });
  await control.end();

  const alfaDb = await createScenarioDatabase('pluto_alfa');
  const betaDb = await createScenarioDatabase('pluto_beta');
  alfa = await openLoadDb(alfaDb);
  beta = await openLoadDb(betaDb);

  await addTenant('Alfa Producciones', 'alfa', alfaDb);
  await addTenant('Beta Eventos', 'beta', betaDb);
  // Activa, pero su base no existe: falla sola, sin tapar a las demás.
  await addTenant('Rota', 'rota', 'pn_night_metrics_no_existe');
  // Suspendida: no está en la agenda.
  const suspended = await addTenant(
    'Suspendida',
    'suspendida',
    'pn_night_metrics_suspendida',
  );
  await getControlDb()
    .update(tenants)
    .set({ status: 'suspended' })
    .where(eq(tenants.id, suspended.id));

  alfaEvent = await seedNight(alfa, 'Noche Alfa', START);
  betaEvent = await seedNight(beta, 'Noche Beta', START);
  betaInvitationEvent = await seedNight(
    beta,
    'Invitación Beta',
    new Date(START.getTime() + 3_600_000),
    { invitation: true },
  );
  betaLaterEvent = await seedNight(
    beta,
    'Beta el mes que viene',
    new Date(START.getTime() + 30 * 86_400_000),
  );
});

after(async () => {
  await alfa?.close();
  await beta?.close();
  for (const name of [
    'pn_load_pluto_alfa',
    'pn_load_pluto_beta',
    'pn_night_metrics_no_existe',
  ]) {
    await closeTenantDb(name);
  }
  await getControlDb().$client.end();
});

describe('POST /api/pluto/agenda (multi-tenant)', () => {
  it('devuelve los eventos de todas las productoras activas, aunque llegue por el dominio raíz', async () => {
    const response = await agenda(
      signedRequest(`${ROOT}/api/pluto/agenda`, {
        action: PLUTO_AGENDA_ACTION,
        ...RANGE,
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.deepEqual(body.instance, {
      mode: 'multi',
      name: 'pn.test',
      url: 'https://pn.test',
      version: {
        commitSha: 'abc1234def',
        commitRef: null,
        environment: null,
        deploymentId: null,
      },
    });
    assert.deepEqual(
      body.tenants.map(
        (tenant: { slug: string; url: string; events: { id: string }[] }) => ({
          slug: tenant.slug,
          url: tenant.url,
          events: tenant.events.map((event) => event.id),
        }),
      ),
      [
        { slug: 'alfa', url: 'https://alfa.pn.test', events: [alfaEvent] },
        {
          slug: 'beta',
          url: 'https://beta.pn.test',
          events: [betaEvent, betaInvitationEvent],
        },
      ],
    );
    assert.deepEqual(body.failedTenants, [{ slug: 'rota', name: 'Rota' }]);
    const invitation = body.tenants[1].events[1];
    assert.equal(
      invitation.isActive,
      false,
      'las no publicadas también vienen',
    );
    assert.equal(invitation.inviteCondition, 'INVITATION');
    assert.ok(
      !JSON.stringify(body).includes(betaLaterEvent),
      'un evento fuera del rango no aparece',
    );
  });

  it('rechaza una firma inválida y un cuerpo de otro endpoint', async () => {
    const forged = await agenda(
      signedRequest(
        `${ROOT}/api/pluto/agenda`,
        { action: PLUTO_AGENDA_ACTION, ...RANGE },
        { secret: 'otra-clave' },
      ),
    );
    assert.equal(forged.status, 401);

    const otherAction = await agenda(
      signedRequest(`${ROOT}/api/pluto/agenda`, {
        action: PLUTO_NIGHT_METRICS_ACTION,
        ...RANGE,
      }),
    );
    assert.equal(otherAction.status, 400);

    const tooLong = await agenda(
      signedRequest(`${ROOT}/api/pluto/agenda`, {
        action: PLUTO_AGENDA_ACTION,
        from: RANGE.from,
        to: new Date(START.getTime() + 200 * 86_400_000).toISOString(),
      }),
    );
    assert.equal(tooLong.status, 400);
  });
});

describe('POST /api/pluto/night-metrics (multi-tenant)', () => {
  it('devuelve las métricas de cada productora, sin nombres, y dice por qué falta cada una', async () => {
    const missingEvent = randomUUID();
    const response = await nightMetrics(
      signedRequest(`${ROOT}/api/pluto/night-metrics`, {
        action: PLUTO_NIGHT_METRICS_ACTION,
        events: [
          { tenant: 'alfa', eventId: alfaEvent },
          { tenant: 'beta', eventId: betaEvent },
          { tenant: 'beta', eventId: missingEvent },
          { tenant: 'suspendida', eventId: alfaEvent },
          { tenant: 'rota', eventId: alfaEvent },
        ],
      }),
    );
    assert.equal(response.status, 200);
    const body = await response.json();

    assert.equal(body.version.commitSha, 'abc1234def');
    const [alfaResult, betaResult, missing, suspended, broken] = body.results;

    const [expectedAlfa] = await getNightMetrics(alfa.db, [alfaEvent]);
    const alfaForPluto: Partial<typeof expectedAlfa> = { ...expectedAlfa };
    delete alfaForPluto.byOrganizer;
    assert.deepEqual(
      { ...alfaResult.metrics, asOf: null },
      { ...alfaForPluto, asOf: null },
    );
    assert.equal(alfaResult.metrics.byOrganizer, undefined);
    assert.deepEqual(alfaResult.metrics.tickets, {
      valid: 2,
      sold: 2,
      entered: 1,
      pending: 1,
      scannedOutsideWindow: 0,
    });
    assert.equal(betaResult.metrics.event.id, betaEvent);
    assert.equal(betaResult.metrics.tickets.entered, 1);
    assert.deepEqual(missing, {
      tenant: 'beta',
      eventId: missingEvent,
      error: 'EVENT_NOT_FOUND',
    });
    assert.equal(suspended.error, 'TENANT_NOT_FOUND');
    assert.equal(broken.error, 'DATA_UNAVAILABLE');
    assert.ok(
      !JSON.stringify(body).includes('Persona'),
      'no viaja ningún nombre',
    );
  });

  it('pide al menos un evento y a lo sumo 50', async () => {
    const empty = await nightMetrics(
      signedRequest(`${ROOT}/api/pluto/night-metrics`, {
        action: PLUTO_NIGHT_METRICS_ACTION,
        events: [],
      }),
    );
    assert.equal(empty.status, 400);

    const tooMany = await nightMetrics(
      signedRequest(`${ROOT}/api/pluto/night-metrics`, {
        action: PLUTO_NIGHT_METRICS_ACTION,
        events: Array.from({ length: 51 }, () => ({
          tenant: 'alfa',
          eventId: randomUUID(),
        })),
      }),
    );
    assert.equal(tooMany.status, 400);
  });
});
