/**
 * Motor del escáner (celular) contra un servidor simulado en memoria con la
 * misma semántica que `scanner.snapshot` / `scanner.sync`: red caída,
 * respuestas perdidas, reloj corrido, doble ingreso y botón de apagado.
 *
 *   npm run test:scanner
 */
import '@tests/load/bootstrap';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';

import {
  LocalScanEngine,
  type EngineEvent,
  type ScannerTransport,
  type SnapshotPayload,
  type SyncPayload,
  type SyncRequest,
} from '@/components/event/individual/scan/local/local-scan-engine';
import { MemoryOutboxStore } from '@/components/event/individual/scan/local/outbox-store';
import {
  type ScannerConfig,
  type SnapshotTicketRow,
} from '@/lib/scan/protocol';
import {
  getLegacyQrKeyBase64,
  serverTicketHash,
} from '@/server/utils/scanner-crypto';
import { decryptString, encryptString } from '@/server/utils/utils';

const EVENT = randomUUID();
const TYPE = randomUUID();
const MULTI_TYPE = randomUUID();
const USER = randomUUID();

type ServerTicket = {
  id: string;
  typeId: string;
  fullName: string;
  scanned: boolean;
  scannedAt: string | null;
  scanCount: number;
};

/** Reloj compartido: el celular puede estar corrido respecto del servidor. */
class Clock {
  server = Date.parse('2026-11-09T02:00:00Z');
  deviceSkewMs = 0;
  device = () => this.server + this.deviceSkewMs;
  advance(ms: number) {
    this.server += ms;
  }
}

class FakeServer implements ScannerTransport {
  tickets = new Map<string, ServerTicket>();
  receipts = new Map<string, SyncPayload['results'][number]>();
  config: ScannerConfig = { mode: 'local', maxStaleSeconds: 60 };
  down = false;
  /** Registra pero la respuesta no llega (se corta en el camino). */
  loseNextResponse = false;
  syncCalls: SyncRequest[] = [];
  registrations = 0;

  constructor(private clock: Clock) {}

  addTicket(fullName: string, typeId = TYPE) {
    const id = randomUUID();
    this.tickets.set(id, {
      id,
      typeId,
      fullName,
      scanned: false,
      scannedAt: null,
      scanCount: 0,
    });
    return { id, code: encryptString(id) };
  }

  /** Otro celular escanea online. */
  scanElsewhere(id: string) {
    const ticket = this.tickets.get(id)!;
    ticket.scanned = true;
    ticket.scannedAt = new Date(this.clock.server).toISOString();
    ticket.scanCount += 1;
  }

  private row(t: ServerTicket): SnapshotTicketRow {
    return [
      serverTicketHash(t.id),
      EVENT,
      t.typeId,
      t.fullName,
      '123',
      null,
      t.scanned,
      t.scannedAt,
      t.scanCount,
    ];
  }

  private types() {
    return [
      {
        id: TYPE,
        name: 'General',
        allowMultipleScans: false,
        startingDate: null,
        scanLimit: null,
      },
      {
        id: MULTI_TYPE,
        name: 'Pulsera',
        allowMultipleScans: true,
        startingDate: null,
        scanLimit: null,
      },
    ];
  }

  async snapshot(): Promise<SnapshotPayload> {
    if (this.down)
      throw Object.assign(new Error('fetch failed'), {
        name: 'TRPCClientError',
      });
    if (this.config.mode === 'off') throw new Error('PRECONDITION_FAILED');
    const now = new Date(this.clock.server).toISOString();
    return {
      serverNow: now,
      cursor: now,
      config: this.config,
      key: getLegacyQrKeyBase64(),
      events: [{ id: EVENT, name: 'Puerta' }],
      types: this.types(),
      tickets: [...this.tickets.values()].map((t) => this.row(t)),
    };
  }

  async sync(input: SyncRequest): Promise<SyncPayload> {
    if (this.down)
      throw Object.assign(new Error('fetch failed'), {
        name: 'TRPCClientError',
      });
    this.syncCalls.push(input);
    const results = input.scans.map((scan) => {
      const known = this.receipts.get(scan.id);
      if (known) return known;
      let id: string | null = null;
      try {
        id = decryptString(scan.code);
      } catch {
        id = null;
      }
      const ticket = id ? this.tickets.get(id) : undefined;
      let result: SyncPayload['results'][number];
      if (!ticket) {
        result = {
          id: scan.id,
          outcome: 'not-found',
          hash: null,
          scannedAt: null,
          scannedByMe: false,
        };
      } else if (ticket.scanned && ticket.typeId !== MULTI_TYPE) {
        result = {
          id: scan.id,
          outcome: 'duplicate',
          hash: serverTicketHash(ticket.id),
          scannedAt: ticket.scannedAt,
          scannedByMe: false,
        };
      } else {
        this.registrations += 1;
        ticket.scanned = true;
        ticket.scannedAt = new Date(this.clock.server).toISOString();
        ticket.scanCount += 1;
        result = {
          id: scan.id,
          outcome: 'registered',
          hash: serverTicketHash(ticket.id),
          scannedAt: ticket.scannedAt,
          scannedByMe: true,
        };
      }
      this.receipts.set(scan.id, result);
      return result;
    });
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw Object.assign(new Error('connection reset'), {
        name: 'TRPCClientError',
      });
    }
    const now = new Date(this.clock.server).toISOString();
    return {
      serverNow: now,
      cursor: now,
      config: this.config,
      results,
      delta: input.cursor
        ? {
            // Simplificado: devuelve todo; el motor tiene que hacer merge.
            scans: [...this.tickets.values()].map((t) => [
              serverTicketHash(t.id),
              t.scanned,
              t.scannedAt,
              t.scanCount,
            ]),
            added: [...this.tickets.values()].map((t) => this.row(t)),
            types: this.types(),
            ticketCount: this.tickets.size,
          }
        : null,
    };
  }
}

let clock: Clock;
let server: FakeServer;
let store: MemoryOutboxStore;
let events: EngineEvent[];

function makeEngine() {
  return new LocalScanEngine({
    transport: server,
    store,
    userId: USER,
    eventIds: [EVENT],
    deviceId: 'device-1',
    now: clock.device,
    onEvent: (event) => events.push(event),
  });
}

async function readyEngine() {
  const engine = makeEngine();
  await engine.start(server.config, { tick: false });
  return engine;
}

/** Deja terminar el ciclo que dispara cada escaneo en segundo plano. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

async function commit(engine: LocalScanEngine, code: string) {
  const evaluation = await engine.evaluate(code);
  assert.equal(evaluation.kind, 'known');
  if (evaluation.kind !== 'known') throw new Error('unreachable');
  assert.equal(evaluation.decision.status, 'success');
  const ticket = await engine.commitLocalSuccess(evaluation, code);
  await settle();
  return ticket;
}

beforeEach(() => {
  clock = new Clock();
  server = new FakeServer(clock);
  store = new MemoryOutboxStore();
  events = [];
});

describe('motor local', () => {
  it('decide entradas conocidas y deja el resto al servidor', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    assert.equal(engine.getStatus().phase, 'ready');
    assert.equal(engine.canDecideLocally(), true);

    const known = await engine.evaluate(ana.code);
    assert.equal(known.kind, 'known');

    const unknown = await engine.evaluate(encryptString(randomUUID()));
    assert.equal(unknown.kind, 'unknown');

    assert.equal((await engine.evaluate('qr-invalido')).kind, 'unreadable');
  });

  it('el ingreso queda en disco antes de devolver, y el segundo escaneo rebota', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true; // que no se suba todavía
    await commit(engine, ana.code);
    assert.equal(store.entries.size, 1, 'el escaneo no quedó guardado');
    const [entry] = store.entries.values();
    assert.equal(entry.code, ana.code);

    const again = await engine.evaluate(ana.code);
    assert.equal(
      again.kind === 'known' && again.decision.status,
      'already-scanned',
    );
    assert.ok(engine.recentLocalSuccessAt(ana.id));
  });

  it('sube los pendientes y vacía la cola', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    await commit(engine, ana.code);
    await engine.poll();
    assert.equal(store.entries.size, 0);
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.tickets.get(ana.id)!.scanned, true);
    assert.equal(server.registrations, 1);
  });

  it('respuesta perdida: el reintento no registra dos veces', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    await commit(engine, ana.code);
    server.down = false;
    server.loseNextResponse = true;
    clock.advance(5_000);
    await engine.poll(); // registra en el servidor, la respuesta se pierde
    assert.equal(server.registrations, 1);
    assert.equal(engine.getStatus().pending, 1);
    clock.advance(20_000);
    await engine.poll(); // reintento con el mismo id
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.registrations, 1);
    assert.equal(events.filter((e) => e.type === 'conflict').length, 0);
  });

  it('sin red pasado N deja de decidir; al volver la red, vuelve', async () => {
    server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    clock.advance(30_000);
    await engine.poll();
    assert.equal(engine.canDecideLocally(), true, 'todavía dentro de N');
    clock.advance(31_000);
    await engine.poll();
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'stale-pull');

    server.down = false;
    clock.advance(20_000);
    await engine.poll();
    assert.equal(engine.canDecideLocally(), true);
  });

  it('un escaneo que no sube en N también apaga la decisión local', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    // La bajada funciona pero la subida falla: se simula con la red caída
    // justo después de decidir.
    server.down = true;
    await commit(engine, ana.code);
    clock.advance(61_000);
    await engine.poll();
    assert.equal(engine.canDecideLocally(), false);
    assert.ok(
      ['stale-pull', 'stale-push'].includes(
        engine.getStatus().staleReason ?? '',
      ),
    );
  });

  it('al volver a primer plano no decide hasta sincronizar', async () => {
    server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    engine.onVisible();
    await engine.poll();
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'resync-after-wake');
    server.down = false;
    clock.advance(20_000);
    await engine.poll();
    assert.equal(engine.canDecideLocally(), true);
  });

  it('doble ingreso entre celulares: avisa con el nombre', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    server.scanElsewhere(ana.id); // otro celular, antes de que lleguen novedades
    await commit(engine, ana.code);
    server.down = false;
    clock.advance(20_000);
    await engine.poll();
    const conflict = events.find((e) => e.type === 'conflict');
    assert.ok(conflict && conflict.type === 'conflict');
    assert.equal(conflict.outcome, 'duplicate');
    assert.equal(conflict.fullName, 'Ana');
    assert.equal(server.registrations, 0);
  });

  it('las novedades traen escaneos de otros celulares y entradas nuevas', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.scanElsewhere(ana.id);
    const nueva = server.addTicket('Nueva');
    clock.advance(11_000);
    await engine.poll();
    const anaNow = await engine.evaluate(ana.code);
    assert.equal(
      anaNow.kind === 'known' && anaNow.decision.status,
      'already-scanned',
    );
    assert.equal((await engine.evaluate(nueva.code)).kind, 'known');
  });

  it('una entrada borrada en el servidor hace recargar la tabla', async () => {
    const ana = server.addTicket('Ana');
    server.addTicket('Beto');
    const engine = await readyEngine();
    server.tickets.delete(ana.id);
    clock.advance(11_000);
    await engine.poll(); // ve otro total
    await engine.poll(); // recarga
    assert.equal(engine.getStatus().tickets, 1);
    assert.equal((await engine.evaluate(ana.code)).kind, 'unknown');
  });

  it('botón de apagado: deja de decidir pero sube lo pendiente', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    await commit(engine, ana.code);
    server.down = false;
    server.config = { mode: 'off', maxStaleSeconds: 60 };
    clock.advance(5_000);
    await engine.poll();
    assert.equal(engine.getStatus().mode, 'off');
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.tickets.get(ana.id)!.scanned, true);
  });

  it('el celular puede bajar el modo del evento, no subirlo', async () => {
    server.addTicket('Ana');
    const engine = await readyEngine();
    engine.setDeviceLimits('shadow', null);
    assert.equal(engine.getStatus().mode, 'shadow');
    assert.equal(engine.canDecideLocally(), false);
    engine.setDeviceLimits('local', 20);
    assert.equal(engine.getStatus().maxStaleSeconds, 20);
    server.config = { mode: 'shadow', maxStaleSeconds: 60 };
    engine.setServerConfig(server.config);
    assert.equal(engine.getStatus().mode, 'shadow');
  });

  it('si no puede guardar en el celular, no decide (va por el servidor)', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    store.failPuts = true;
    const evaluation = await engine.evaluate(ana.code);
    assert.equal(evaluation.kind, 'known');
    if (evaluation.kind !== 'known') return;
    await assert.rejects(engine.commitLocalSuccess(evaluation, ana.code));
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'storage');
    assert.equal(server.registrations, 0);
  });

  it('otra pestaña tiene el escáner: esta no decide', async () => {
    server.addTicket('Ana');
    const engine = await readyEngine();
    engine.setLeader(false);
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'not-leader');
  });

  it('pestaña cerrada con pendientes: al reabrir se suben', async () => {
    const ana = server.addTicket('Ana');
    const beto = server.addTicket('Beto');
    const first = await readyEngine();
    server.down = true;
    await commit(first, ana.code);
    await commit(first, beto.code);
    first.stop();

    server.down = false;
    const second = makeEngine();
    await second.start(server.config, { tick: false });
    assert.equal(second.getStatus().pending, 0);
    assert.equal(server.registrations, 2);
    // La tabla nueva ya sabe que entraron.
    const anaAgain = await second.evaluate(ana.code);
    assert.equal(
      anaAgain.kind === 'known' && anaAgain.decision.status,
      'already-scanned',
    );
  });

  it('pendientes de otro usuario no se suben con esta sesión', async () => {
    const ana = server.addTicket('Ana');
    const first = await readyEngine();
    server.down = true;
    await commit(first, ana.code);
    first.stop();
    for (const entry of store.entries.values()) entry.userId = randomUUID();

    server.down = false;
    const second = makeEngine();
    await second.start(server.config, { tick: false });
    assert.equal(server.registrations, 0);
    assert.equal(store.entries.size, 1);
  });

  it('celular con la hora corrida: la hora del escaneo sale corregida', async () => {
    const ana = server.addTicket('Ana');
    clock.deviceSkewMs = -3_600_000; // una hora atrasado
    const engine = await readyEngine();
    assert.equal(engine.canDecideLocally(), true);
    server.down = true;
    await commit(engine, ana.code);
    const [entry] = store.entries.values();
    assert.ok(
      Math.abs(entry.at - clock.server) < 1_000,
      'la hora no se corrigió',
    );
  });

  it('multiescaneo: decide en el celular cada vez', async () => {
    const pulsera = server.addTicket('Pulsera', MULTI_TYPE);
    const engine = await readyEngine();
    await commit(engine, pulsera.code);
    const second = await commit(engine, pulsera.code);
    assert.equal(second.scanCount, 2);
    await engine.poll();
    assert.equal(server.tickets.get(pulsera.id)!.scanCount, 2);
  });

  it('sin tabla todavía (o en modo apagado) no decide', async () => {
    server.addTicket('Ana');
    server.down = true;
    const engine = makeEngine();
    await engine.start(server.config, { tick: false });
    assert.equal(engine.getStatus().phase, 'error');
    assert.equal(engine.canDecideLocally(), false);

    const off = makeEngine();
    await off.start({ mode: 'off', maxStaleSeconds: 60 }, { tick: false });
    assert.equal(off.getStatus().phase, 'idle');
    assert.equal(off.canDecideLocally(), false);
  });
});
