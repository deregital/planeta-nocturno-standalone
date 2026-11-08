/**
 * Servidor del escáner contra un Postgres real con las migraciones del repo:
 * escaneo online, configuración por evento, tabla para el celular y
 * sincronización idempotente. Usa la misma base que la prueba de carga
 * (LOAD_ADMIN_DATABASE_URL, por defecto postgres://postgres:pg@localhost:5432).
 *
 *   npm run test:scanner
 */
import '@tests/load/bootstrap';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { TRPCError } from '@trpc/server';

import { callerFor } from '@tests/load/lib/caller';
import {
  createScenarioDatabase,
  openLoadDb,
  type LoadDb,
} from '@tests/load/lib/db';
import {
  assignUserToEvent,
  insertEvent,
  insertSoldTickets,
  insertUser,
} from '@tests/load/lib/seed';
import { decryptLegacyQr, importLegacyQrKey } from '@/lib/scan/legacy-qr';
import { SCANNER_MIGRATION_MISSING_MESSAGE } from '@/server/routers/scanner';
import { serverTicketHash } from '@/server/utils/scanner-crypto';
import { encryptString } from '@/server/utils/utils';

process.env.BARCODE_SECRET ??= 'scanner-test-secret';

let load: LoadDb;
let eventA: string;
let eventB: string;
let multiTypeId: string;
let ticketsA: string[];
let multiTicket: string;
let ticketB: string;
let adminId: string;
let doorId: string;
let door2Id: string;
let outsiderId: string;

const admin = () => callerFor(load.db, { id: adminId, role: 'ADMIN' });
const door = () =>
  callerFor(load.db, { id: doorId, role: 'CONTROL_TICKETING' });
const door2 = () =>
  callerFor(load.db, { id: door2Id, role: 'CONTROL_TICKETING' });
const outsider = () =>
  callerFor(load.db, { id: outsiderId, role: 'CONTROL_TICKETING' });

async function expectTrpcError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TRPCError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

async function scanRows(ticketId: string) {
  const { rows } = await load.raw.query(
    `SELECT count(*)::int AS n FROM "emittedTicketScan" WHERE "emittedTicketId" = $1`,
    [ticketId],
  );
  return rows[0].n as number;
}

async function setMode(eventId: string, mode: 'off' | 'shadow' | 'local') {
  await admin().scanner.setConfig({ eventId, mode, maxStaleSeconds: 60 });
}

before(async () => {
  process.env.SCANNER_LOCAL_MODE_ENABLED = 'true';
  load = await openLoadDb(await createScenarioDatabase('scanner_server'));
  const { raw } = load;

  const a = await insertEvent(raw, {
    name: 'Puerta A',
    ticketTypes: [
      { name: 'General', price: 15000, maxAvailable: 500 },
      { name: 'Pulsera', price: 0, maxAvailable: 500 },
    ],
  });
  eventA = a.eventId;
  multiTypeId = a.ticketTypeIds[1];
  await raw.query(
    `UPDATE "ticketType" SET "allowMultipleScans" = true, "startingDate" = NULL WHERE id = $1`,
    [multiTypeId],
  );
  await raw.query(
    `UPDATE "ticketType" SET "startingDate" = NULL WHERE id = $1`,
    [a.ticketTypeIds[0]],
  );
  await insertSoldTickets(raw, {
    eventId: eventA,
    ticketTypeIds: [a.ticketTypeIds[0]],
    groups: 20,
    withAnswers: false,
  });
  await insertSoldTickets(raw, {
    eventId: eventA,
    ticketTypeIds: [multiTypeId],
    groups: 1,
    withAnswers: false,
  });

  const b = await insertEvent(raw, {
    name: 'Puerta B',
    ticketTypes: [{ name: 'General', price: 1000, maxAvailable: 100 }],
  });
  eventB = b.eventId;
  await insertSoldTickets(raw, {
    eventId: eventB,
    ticketTypeIds: b.ticketTypeIds,
    groups: 2,
    withAnswers: false,
  });

  ticketsA = (
    await raw.query(
      `SELECT id FROM "emittedTicket" WHERE "eventId" = $1 AND "ticketTypeId" = $2 ORDER BY id`,
      [eventA, a.ticketTypeIds[0]],
    )
  ).rows.map((r) => r.id as string);
  multiTicket = (
    await raw.query(
      `SELECT id FROM "emittedTicket" WHERE "ticketTypeId" = $1 LIMIT 1`,
      [multiTypeId],
    )
  ).rows[0].id;
  ticketB = (
    await raw.query(
      `SELECT id FROM "emittedTicket" WHERE "eventId" = $1 LIMIT 1`,
      [eventB],
    )
  ).rows[0].id;

  adminId = await insertUser(raw, 'ADMIN');
  doorId = await insertUser(raw, 'CONTROL_TICKETING');
  door2Id = await insertUser(raw, 'CONTROL_TICKETING');
  outsiderId = await insertUser(raw, 'CONTROL_TICKETING');
  await assignUserToEvent(raw, doorId, eventA);
  await assignUserToEvent(raw, door2Id, eventA);
  await assignUserToEvent(raw, outsiderId, eventB);
});

after(async () => {
  await load?.close();
});

describe('escaneo online (emittedTickets.scan)', () => {
  it('rechaza eventos no asignados', async () => {
    await expectTrpcError(
      outsider().emittedTickets.scan({
        barcode: encryptString(ticketsA[0]),
        eventIds: [eventA],
      }),
      'FORBIDDEN',
    );
    assert.equal(await scanRows(ticketsA[0]), 0);
  });

  it('registra, avisa el reescaneo propio y no manda datos de contacto', async () => {
    const barcode = encryptString(ticketsA[0]);
    const first = await door().emittedTickets.scan({
      barcode,
      eventIds: [eventA],
    });
    assert.equal(first.status, 'success');
    assert.equal(first.scannedByMe, true);
    assert.ok(first.ticket);
    assert.ok(!('mail' in first.ticket));
    assert.ok(!('phoneNumber' in first.ticket));
    assert.ok(!('birthDate' in first.ticket));
    assert.equal(first.ticket.ticketGroup.event.id, eventA);

    const again = await door().emittedTickets.scan({
      barcode,
      eventIds: [eventA],
    });
    assert.equal(again.status, 'already-scanned');
    assert.equal(again.scannedByMe, true);

    const other = await door2().emittedTickets.scan({
      barcode,
      eventIds: [eventA],
    });
    assert.equal(other.status, 'already-scanned');
    assert.equal(other.scannedByMe, false);
    assert.equal(await scanRows(ticketsA[0]), 1);
  });

  it('QR inválido o de otro evento: no encontrado', async () => {
    const garbage = await door().emittedTickets.scan({
      barcode: 'qr-invalido',
      eventIds: [eventA],
    });
    assert.equal(garbage.status, 'not-found');
    const otherEvent = await door().emittedTickets.scan({
      barcode: encryptString(ticketB),
      eventIds: [eventA],
    });
    assert.equal(otherEvent.status, 'not-found');
    // Formato válido que descifra a algo que no es un id: antes era un 500.
    const notAnId = await door().emittedTickets.scan({
      barcode: encryptString('no-es-un-uuid'),
      eventIds: [eventA],
    });
    assert.equal(notAnId.status, 'not-found');
  });
});

describe('configuración por evento', () => {
  it('sin habilitar la instalación, todo queda en off', async () => {
    process.env.SCANNER_LOCAL_MODE_ENABLED = 'false';
    try {
      const config = await door().scanner.config({ eventIds: [eventA] });
      assert.equal(config.available, false);
      assert.equal(config.effective.mode, 'off');
      await expectTrpcError(
        admin().scanner.setConfig({
          eventId: eventA,
          mode: 'local',
          maxStaleSeconds: 60,
        }),
        'PRECONDITION_FAILED',
      );
      await expectTrpcError(
        door().scanner.snapshot({ protocol: 1, eventIds: [eventA] }),
        'PRECONDITION_FAILED',
      );
    } finally {
      process.env.SCANNER_LOCAL_MODE_ENABLED = 'true';
    }
  });

  it('por defecto off; solo quien edita eventos lo cambia', async () => {
    const initial = await door().scanner.config({ eventIds: [eventA] });
    assert.equal(initial.available, true);
    assert.equal(initial.canEdit, false);
    assert.equal(initial.effective.mode, 'off');

    await expectTrpcError(
      door().scanner.setConfig({
        eventId: eventA,
        mode: 'local',
        maxStaleSeconds: 60,
      }),
      'FORBIDDEN',
    );

    const saved = await admin().scanner.setConfig({
      eventId: eventA,
      mode: 'local',
      maxStaleSeconds: 9999,
    });
    assert.deepEqual(saved, { mode: 'local', maxStaleSeconds: 300 });

    const both = await admin().scanner.config({ eventIds: [eventA, eventB] });
    assert.equal(both.canEdit, true);
    // Con dos eventos manda el más conservador (B sigue en off).
    assert.equal(both.effective.mode, 'off');
    await setMode(eventA, 'local');
  });

  it('el celular sin acceso al evento no ve la configuración', async () => {
    await expectTrpcError(
      outsider().scanner.config({ eventIds: [eventA] }),
      'FORBIDDEN',
    );
  });
});

describe('tabla para el celular (snapshot)', () => {
  it('trae hashes, nunca ids, y la clave lee los QR', async () => {
    await setMode(eventA, 'local');
    const snapshot = await door().scanner.snapshot({
      protocol: 1,
      eventIds: [eventA],
    });
    const { rows } = await load.raw.query(
      `SELECT id, dni, "fullName" FROM "emittedTicket" WHERE "eventId" = $1`,
      [eventA],
    );
    assert.equal(snapshot.tickets.length, rows.length);
    assert.equal(snapshot.config.mode, 'local');

    const payload = JSON.stringify(snapshot);
    // En el seed el nombre es "Persona <dni>": se revisa sin los nombres.
    const withoutNames = JSON.stringify(
      snapshot.tickets.map((t) => t.filter((_, i) => i !== 3)),
    );
    for (const row of rows) {
      assert.ok(
        !payload.includes(row.id),
        'el id de una entrada viajó al celular',
      );
      assert.ok(
        !withoutNames.includes(row.dni),
        'el DNI completo viajó al celular',
      );
    }

    const byHash = new Map(snapshot.tickets.map((t) => [t[0], t]));
    const sample = rows[0];
    const entry = byHash.get(serverTicketHash(sample.id));
    assert.ok(entry);
    assert.equal(entry[1], eventA);
    assert.equal(entry[3], sample.fullName);
    assert.equal(entry[4], sample.dni.slice(-3));

    const scanned = byHash.get(serverTicketHash(ticketsA[0]));
    assert.equal(scanned?.[6], true);
    assert.equal(scanned?.[8], 1);

    const key = await importLegacyQrKey(snapshot.key);
    assert.equal(
      await decryptLegacyQr(encryptString(sample.id), key),
      sample.id,
    );
    assert.ok(
      snapshot.types.some((t) => t.id === multiTypeId && t.allowMultipleScans),
    );
  });

  it('modo apagado: no hay tabla ni clave', async () => {
    await setMode(eventA, 'off');
    await expectTrpcError(
      door().scanner.snapshot({ protocol: 1, eventIds: [eventA] }),
      'PRECONDITION_FAILED',
    );
    await setMode(eventA, 'local');
  });

  it('sin acceso al evento: prohibido', async () => {
    await expectTrpcError(
      outsider().scanner.snapshot({ protocol: 1, eventIds: [eventA] }),
      'FORBIDDEN',
    );
  });
});

describe('sincronización', () => {
  const deviceId = 'device-test-1';

  async function push(
    caller: ReturnType<typeof door>,
    scans: { id: string; code: string; at?: number }[],
    cursor: string | null = null,
  ) {
    return caller.scanner.sync({
      protocol: 1,
      eventIds: [eventA],
      deviceId,
      cursor,
      scans: scans.map((s) => ({ at: Date.now(), ...s })),
    });
  }

  it('registra el escaneo local y el reintento no duplica', async () => {
    const ticket = ticketsA[1];
    const scan = { id: randomUUID(), code: encryptString(ticket) };
    const first = await push(door(), [scan]);
    assert.equal(first.results[0].outcome, 'registered');
    assert.equal(first.results[0].hash, serverTicketHash(ticket));

    const replay = await push(door(), [scan]);
    assert.equal(replay.results[0].outcome, 'registered');
    assert.equal(await scanRows(ticket), 1);

    const { rows } = await load.raw.query(
      `SELECT outcome, "deviceId", "emittedTicketId", "eventId" FROM "scanReceipt" WHERE "clientScanId" = $1`,
      [scan.id],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcome, 'registered');
    assert.equal(rows[0].emittedTicketId, ticket);
    assert.equal(rows[0].eventId, eventA);
  });

  it('dos subidas simultáneas del mismo escaneo: un solo ingreso', async () => {
    const ticket = ticketsA[2];
    const scan = { id: randomUUID(), code: encryptString(ticket) };
    const [a, b] = await Promise.all([
      push(door(), [scan]),
      push(door(), [scan]),
    ]);
    assert.deepEqual(
      [a.results[0].outcome, b.results[0].outcome],
      ['registered', 'registered'],
    );
    assert.equal(await scanRows(ticket), 1);
  });

  it('el mismo QR en dos celulares: el segundo es doble ingreso', async () => {
    const ticket = ticketsA[3];
    const first = await push(door(), [
      { id: randomUUID(), code: encryptString(ticket) },
    ]);
    assert.equal(first.results[0].outcome, 'registered');
    const second = await push(door2(), [
      { id: randomUUID(), code: encryptString(ticket) },
    ]);
    assert.equal(second.results[0].outcome, 'duplicate');
    assert.equal(second.results[0].scannedByMe, false);
    assert.ok(second.results[0].scannedAt);
    assert.equal(await scanRows(ticket), 1);
  });

  it('QR inválido, de otro evento o borrado: no encontrado', async () => {
    const result = await push(door(), [
      { id: randomUUID(), code: 'qr-invalido' },
      { id: randomUUID(), code: encryptString(ticketB) },
      { id: randomUUID(), code: encryptString(randomUUID()) },
      { id: randomUUID(), code: encryptString('no-es-un-uuid') },
    ]);
    assert.deepEqual(
      result.results.map((r) => r.outcome),
      ['not-found', 'not-found', 'not-found', 'not-found'],
    );
    assert.equal(await scanRows(ticketB), 0);
  });

  it('multiescaneo: cada escaneo cuenta', async () => {
    const first = await push(door(), [
      { id: randomUUID(), code: encryptString(multiTicket) },
    ]);
    const second = await push(door(), [
      { id: randomUUID(), code: encryptString(multiTicket) },
    ]);
    assert.equal(first.results[0].outcome, 'registered');
    assert.equal(second.results[0].outcome, 'registered');
    assert.equal(await scanRows(multiTicket), 2);
  });

  it('las novedades traen escaneos de otros, entradas nuevas y el total', async () => {
    const snapshot = await door().scanner.snapshot({
      protocol: 1,
      eventIds: [eventA],
    });

    // Otro celular escanea online y se crea una entrada nueva en la puerta.
    const scannedOnline = ticketsA[4];
    const online = await door2().emittedTickets.scan({
      barcode: encryptString(scannedOnline),
      eventIds: [eventA],
    });
    assert.equal(online.status, 'success');
    const { rows } = await load.raw.query(
      `INSERT INTO "emittedTicket" ("fullName", dni, mail, gender, "phoneNumber", "birthDate",
         slug, "ticketTypeId", "ticketGroupId", "eventId", "shortId")
       SELECT 'Persona Nueva', '44111222', 'nueva@mail.test', 'female', '+5491100000000',
              '2000-01-01', 'entrada-nueva', "ticketTypeId", "ticketGroupId", "eventId",
              (SELECT max("shortId") + 1 FROM "emittedTicket" WHERE "eventId" = $1)
       FROM "emittedTicket" WHERE id = $2
       RETURNING id`,
      [eventA, ticketsA[5]],
    );
    const newTicket = rows[0].id as string;

    const sync = await push(door(), [], snapshot.cursor);
    assert.ok(sync.delta);
    const changed = sync.delta.scans.find(
      (s) => s[0] === serverTicketHash(scannedOnline),
    );
    assert.ok(changed, 'falta el escaneo del otro celular');
    assert.equal(changed[1], true);
    const added = sync.delta.added.find(
      (t) => t[0] === serverTicketHash(newTicket),
    );
    assert.ok(added, 'falta la entrada nueva');
    assert.equal(added[3], 'Persona Nueva');
    assert.equal(added[4], '222');
    assert.equal(sync.delta.ticketCount, snapshot.tickets.length + 1);

    // Una entrada borrada baja el total: el celular sabe que tiene que recargar.
    await load.raw.query(`DELETE FROM "emittedTicket" WHERE id = $1`, [
      newTicket,
    ]);
    const afterDelete = await push(door(), [], sync.cursor);
    assert.equal(afterDelete.delta?.ticketCount, snapshot.tickets.length);
  });

  it('con el modo apagado igual acepta lo pendiente (no se pierde un ingreso)', async () => {
    await setMode(eventA, 'off');
    try {
      const ticket = ticketsA[6];
      const result = await push(door(), [
        { id: randomUUID(), code: encryptString(ticket) },
      ]);
      assert.equal(result.config.mode, 'off');
      assert.equal(result.results[0].outcome, 'registered');
      assert.equal(await scanRows(ticket), 1);
    } finally {
      await setMode(eventA, 'local');
    }
  });

  it('sin acceso al evento: prohibido', async () => {
    await expectTrpcError(
      push(outsider(), [
        { id: randomUUID(), code: encryptString(ticketsA[7]) },
      ]),
      'FORBIDDEN',
    );
    assert.equal(await scanRows(ticketsA[7]), 0);
  });
});

describe('base sin la migración del escaneo', () => {
  it('leer anda (todo en off); cambiar el modo o subir escaneos da un error claro', async () => {
    const { raw } = load;
    await raw.query(
      `ALTER TABLE "eventScannerConfig" RENAME TO "eventScannerConfig_hidden"`,
    );
    await raw.query(`ALTER TABLE "scanReceipt" RENAME TO "scanReceipt_hidden"`);
    try {
      const config = await door().scanner.config({ eventIds: [eventA] });
      assert.equal(config.effective.mode, 'off');

      const clear = (error: unknown) => {
        assert.ok(error instanceof TRPCError, String(error));
        assert.equal(error.code, 'PRECONDITION_FAILED');
        assert.equal(error.message, SCANNER_MIGRATION_MISSING_MESSAGE);
        return true;
      };
      await assert.rejects(
        admin().scanner.setConfig({
          eventId: eventA,
          mode: 'shadow',
          maxStaleSeconds: 60,
        }),
        clear,
      );
      const ticket = ticketsA[15];
      await assert.rejects(
        door().scanner.sync({
          protocol: 1,
          eventIds: [eventA],
          deviceId: 'sin-migrar',
          cursor: null,
          scans: [
            { id: randomUUID(), code: encryptString(ticket), at: Date.now() },
          ],
        }),
        clear,
      );
      assert.equal(await scanRows(ticket), 0, 'se registró sin recibo');
    } finally {
      await raw.query(
        `ALTER TABLE "eventScannerConfig_hidden" RENAME TO "eventScannerConfig"`,
      );
      await raw.query(
        `ALTER TABLE "scanReceipt_hidden" RENAME TO "scanReceipt"`,
      );
    }
  });
});
