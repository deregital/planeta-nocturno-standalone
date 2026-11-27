/**
 * Métricas de la noche contra un Postgres real con las migraciones del repo:
 * qué cuenta como entrada, como ingreso y como recaudado, y el alcance por
 * organizador. Usa la misma base que la prueba de carga
 * (LOAD_ADMIN_DATABASE_URL, por defecto postgres://postgres:pg@localhost:5432).
 *
 *   npm run test:night-metrics
 */
import '@tests/load/bootstrap';

import type { Pool } from 'pg';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  createScenarioDatabase,
  openLoadDb,
  type LoadDb,
} from '@tests/load/lib/db';
import { insertEvent, insertUser } from '@tests/load/lib/seed';
import {
  getCalendarStatsByEventId,
  getCalendarStatsByEventIds,
} from '@/server/services/calendarEventStats';
import { getNightMetrics } from '@/server/services/nightMetrics';

const START = new Date('2026-11-20T23:00:00.000Z');
const at = (minutes: number) =>
  new Date(START.getTime() + minutes * 60_000).toISOString();

let load: LoadDb;
let eventA: string;
let eventB: string;
let deletedEvent: string;
let anaId: string;
let betoId: string;
let types: Record<'general' | 'invitation' | 'organizer' | 'multi', string>;
let shortId = 0;

type GroupSeed = {
  eventId: string;
  status: 'PAID' | 'FREE' | 'BOOKED';
  paymentMethod?: 'MERCADO_PAGO' | 'TRANSFER' | 'ON_SITE' | 'TALO' | null;
  invitedById?: string | null;
  isOrganizerGroup?: boolean;
  totalAmount?: number;
  /** Una entrada por elemento: los minutos de cada escaneo desde START. */
  tickets: { typeId: string; scans?: number[]; legacyScanAt?: number }[];
};

async function insertGroup(raw: Pool, seed: GroupSeed) {
  const groupId = randomUUID();
  await raw.query(
    `INSERT INTO "ticketGroup" (id, status, "amountTickets", event_id, "invitedById",
       "isOrganizerGroup", "totalAmount", "paymentMethod")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      groupId,
      seed.status,
      seed.tickets.length,
      seed.eventId,
      seed.invitedById ?? null,
      seed.isOrganizerGroup ?? false,
      seed.totalAmount ?? 0,
      seed.paymentMethod ?? null,
    ],
  );

  for (const ticket of seed.tickets) {
    shortId += 1;
    const ticketId = randomUUID();
    const scans = ticket.scans ?? [];
    const lastScan =
      ticket.legacyScanAt ?? (scans.length ? Math.max(...scans) : null);
    await raw.query(
      `INSERT INTO "emittedTicket" (id, "fullName", dni, mail, gender, "phoneNumber",
         "birthDate", slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId",
         scanned, "scannedAt")
       VALUES ($1, 'Persona', $2, 'persona@mail.test', 'female', '+5491155550000',
         '2000-01-01', $3, $4, $5, $6, $7, $8, $9)`,
      [
        ticketId,
        String(30_000_000 + shortId),
        `entrada-${ticketId.slice(0, 8)}`,
        ticket.typeId,
        groupId,
        seed.eventId,
        shortId,
        lastScan !== null,
        lastScan === null ? null : at(lastScan),
      ],
    );
    for (const minutes of scans) {
      await raw.query(
        `INSERT INTO "emittedTicketScan" ("emittedTicketId", "scannedAt") VALUES ($1, $2)`,
        [ticketId, at(minutes)],
      );
    }
  }
  return groupId;
}

before(async () => {
  load = await openLoadDb(await createScenarioDatabase('night_metrics'));
  const { raw } = load;

  anaId = await insertUser(raw, 'ORGANIZER');
  betoId = await insertUser(raw, 'ORGANIZER');
  await raw.query(`UPDATE "user" SET "fullName" = 'Ana Pérez' WHERE id = $1`, [
    anaId,
  ]);
  await raw.query(`UPDATE "user" SET "fullName" = 'Beto Gómez' WHERE id = $1`, [
    betoId,
  ]);

  const a = await insertEvent(raw, {
    name: 'Noche A',
    startingDate: START,
    ticketTypes: [
      { name: 'General', price: 10_000, maxAvailable: 100 },
      { name: 'Invitación', price: 0, maxAvailable: 100 },
      { name: 'Organizador', price: 0, maxAvailable: 100 },
      { name: 'Multipase', price: 10_000, maxAvailable: 100 },
    ],
  });
  eventA = a.eventId;
  const [general, invitation, organizer, multi] = a.ticketTypeIds;
  types = { general, invitation, organizer, multi };
  await raw.query(
    `UPDATE "ticketType" SET "allowMultipleScans" = true WHERE id = $1`,
    [multi],
  );

  // Paga, de Ana: una entró a los 30 minutos y la otra no vino.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'PAID',
    paymentMethod: 'MERCADO_PAGO',
    invitedById: anaId,
    totalAmount: 20_000,
    tickets: [{ typeId: general, scans: [30] }, { typeId: general }],
  });
  // Invitación canjeada de Beto.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'FREE',
    invitedById: betoId,
    tickets: [{ typeId: invitation, scans: [31] }],
  });
  // A cobrar en el lugar: cuenta y entró, pero todavía no es recaudado.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'BOOKED',
    paymentMethod: 'ON_SITE',
    totalAmount: 10_000,
    tickets: [{ typeId: general, scans: [30] }],
  });
  // Reservas sin pagar: van aparte.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'BOOKED',
    paymentMethod: 'MERCADO_PAGO',
    totalAmount: 20_000,
    tickets: [{ typeId: general }, { typeId: general }],
  });
  await insertGroup(raw, {
    eventId: eventA,
    status: 'BOOKED',
    paymentMethod: 'TRANSFER',
    tickets: [{ typeId: general }],
  });
  await insertGroup(raw, {
    eventId: eventA,
    status: 'BOOKED',
    paymentMethod: null,
    tickets: [{ typeId: general }],
  });
  // Un medio de pago sin balde propio.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'BOOKED',
    paymentMethod: 'TALO',
    tickets: [{ typeId: general }],
  });
  // Entradas de los organizadores: aparte.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'FREE',
    isOrganizerGroup: true,
    tickets: [{ typeId: organizer, scans: [10] }, { typeId: organizer }],
  });
  // Paga, de Ana, escaneada tres días antes: una prueba, no un ingreso.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'PAID',
    paymentMethod: 'MERCADO_PAGO',
    invitedById: anaId,
    totalAmount: 10_000,
    tickets: [{ typeId: general, scans: [-3 * 24 * 60] }],
  });
  // Multipase de Beto: el ingreso es el primer escaneo, el reingreso no suma.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'PAID',
    paymentMethod: 'MERCADO_PAGO',
    invitedById: betoId,
    totalAmount: 10_000,
    tickets: [{ typeId: multi, scans: [45, 90] }],
  });
  // Escaneada antes de que existiera el historial de escaneos.
  await insertGroup(raw, {
    eventId: eventA,
    status: 'FREE',
    invitedById: betoId,
    tickets: [{ typeId: invitation, legacyScanAt: 45 }],
  });
  // Compra arrepentida: sus entradas ya están en la papelera.
  const withdrawnGroup = await insertGroup(raw, {
    eventId: eventA,
    status: 'PAID',
    paymentMethod: 'MERCADO_PAGO',
    invitedById: anaId,
    totalAmount: 50_000,
    tickets: [],
  });
  await raw.query(
    `INSERT INTO "withdrawalRequest" ("ticketGroupId", "eventId", "eventName", "ticketCount",
       "fullName", mail, dni, amount, "refundAccount")
     VALUES ($1, $2, 'Noche A', 5, 'Persona', 'persona@mail.test', '30000000', 50000, 'alias.prueba')`,
    [withdrawnGroup, eventA],
  );

  const b = await insertEvent(raw, {
    name: 'Noche B',
    startingDate: START,
    ticketTypes: [{ name: 'General', price: 5_000, maxAvailable: 100 }],
  });
  eventB = b.eventId;
  await insertGroup(raw, {
    eventId: eventB,
    status: 'PAID',
    paymentMethod: 'MERCADO_PAGO',
    totalAmount: 5_000,
    tickets: [{ typeId: b.ticketTypeIds[0], scans: [5] }],
  });

  const deleted = await insertEvent(raw, {
    name: 'Noche borrada',
    startingDate: START,
    ticketTypes: [{ name: 'General', price: 5_000, maxAvailable: 100 }],
  });
  deletedEvent = deleted.eventId;
  await raw.query(`UPDATE event SET "isDeleted" = true WHERE id = $1`, [
    deletedEvent,
  ]);
});

after(async () => {
  await load?.close();
});

describe('getNightMetrics', () => {
  it('cuenta entradas, ingresos, pruebas y pendientes con una sola definición', async () => {
    const [metrics] = await getNightMetrics(load.db, [eventA]);

    assert.deepEqual(metrics.tickets, {
      valid: 7,
      sold: 5,
      entered: 5,
      pending: 1,
      scannedOutsideWindow: 1,
    });
    assert.equal(
      metrics.tickets.entered +
        metrics.tickets.scannedOutsideWindow +
        metrics.tickets.pending,
      metrics.tickets.valid,
    );
    assert.deepEqual(metrics.organizers, { valid: 2, entered: 1 });
    assert.deepEqual(metrics.unpaid, {
      mercadoPago: 2,
      transfer: 1,
      checkout: 1,
      other: 1,
    });
    assert.equal(metrics.raised, 40_000);
    assert.equal(metrics.firstEntryAt, at(30));
    assert.equal(metrics.lastEntryAt, at(45));
    assert.equal(metrics.event.startingDate, START.toISOString());
  });

  it('arma la curva por minuto con el primer escaneo de cada entrada', async () => {
    const [metrics] = await getNightMetrics(load.db, [eventA]);

    assert.deepEqual(metrics.entriesPerMinute, [
      { minute: at(30), entries: 2 },
      { minute: at(31), entries: 1 },
      { minute: at(45), entries: 2 },
    ]);
  });

  it('desglosa por tipo de entrada y por organizador', async () => {
    const [metrics] = await getNightMetrics(load.db, [eventA]);

    assert.deepEqual(
      metrics.byTicketType.map(({ id, name, valid, entered }) => ({
        id,
        name,
        valid,
        entered,
      })),
      [
        { id: types.general, name: 'General', valid: 4, entered: 2 },
        { id: types.invitation, name: 'Invitación', valid: 2, entered: 2 },
        { id: types.multi, name: 'Multipase', valid: 1, entered: 1 },
      ],
    );
    assert.deepEqual(metrics.byOrganizer, [
      { id: anaId, name: 'Ana Pérez', valid: 3, entered: 1 },
      { id: betoId, name: 'Beto Gómez', valid: 3, entered: 3 },
      { id: null, name: 'Sin organizador', valid: 1, entered: 1 },
    ]);
  });

  it('limita todo a las compras e invitaciones del organizador', async () => {
    const [metrics] = await getNightMetrics(load.db, [eventA], {
      kind: 'invitedBy',
      userIds: [anaId],
    });

    assert.deepEqual(metrics.tickets, {
      valid: 3,
      sold: 3,
      entered: 1,
      pending: 1,
      scannedOutsideWindow: 1,
    });
    assert.deepEqual(metrics.organizers, { valid: 0, entered: 0 });
    assert.deepEqual(metrics.unpaid, {
      mercadoPago: 0,
      transfer: 0,
      checkout: 0,
      other: 0,
    });
    assert.equal(metrics.raised, 30_000);
    assert.deepEqual(
      metrics.byOrganizer.map((row) => row.id),
      [anaId],
    );

    const [empty] = await getNightMetrics(load.db, [eventA], {
      kind: 'invitedBy',
      userIds: [],
    });
    assert.equal(empty.tickets.valid, 0);
    assert.equal(empty.raised, 0);
  });

  it('resuelve varias noches juntas, en el orden pedido, sin las borradas', async () => {
    const metrics = await getNightMetrics(load.db, [
      eventB,
      deletedEvent,
      eventA,
      eventB,
    ]);

    assert.deepEqual(
      metrics.map((row) => row.event.id),
      [eventB, eventA],
    );
    assert.equal(metrics[0].tickets.entered, 1);
    assert.equal(metrics[0].raised, 5_000);
    assert.equal(metrics[1].tickets.valid, 7);
    assert.deepEqual(await getNightMetrics(load.db, []), []);
    assert.deepEqual(await getNightMetrics(load.db, [randomUUID()]), []);
  });
});

describe('getCalendarStatsByEventId', () => {
  it('muestra en el calendario las mismas cuentas que las métricas de la noche', async () => {
    const stats = await getCalendarStatsByEventId(load.db, eventA);

    assert.deepEqual(stats, {
      ticketsSold: 5,
      ticketsIssued: 7,
      ticketsScanned: 6,
      attendanceRate: (6 / 7) * 100,
      totalRaised: 40_000,
    });
  });

  it('calcula varios eventos juntos, con ceros para los que no existen', async () => {
    const missing = randomUUID();
    const stats = await getCalendarStatsByEventIds(load.db, [
      eventA,
      eventB,
      missing,
    ]);

    assert.deepEqual(
      stats.get(eventA),
      await getCalendarStatsByEventId(load.db, eventA),
    );
    assert.equal(stats.get(eventB)?.ticketsScanned, 1);
    assert.deepEqual(stats.get(missing), {
      ticketsSold: 0,
      ticketsIssued: 0,
      ticketsScanned: 0,
      attendanceRate: 0,
      totalRaised: 0,
    });
  });
});
