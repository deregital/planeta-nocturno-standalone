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
  CONFIG_CHECK_MS,
  LocalScanEngine,
  type EngineEvent,
  type LeaderState,
  NETWORK_RESET_MIN_MS,
  PENDING_MAX_BACKOFF_MS,
  SNAPSHOT_REFRESH_MS,
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
  /** El pedido sale por una red muerta y no vuelve hasta que se lo corta. */
  hang = false;
  /** Registra pero la respuesta no llega (se corta en el camino). */
  loseNextResponse = false;
  /** Solo la sincronización falla (la tabla baja bien). */
  failSync = false;
  /** Subidas de estos eventos dan FORBIDDEN (el usuario ya no está asignado). */
  forbiddenEvents = new Set<string>();
  /** La tabla se arma al pedirla pero llega recién con `releaseSnapshot()`. */
  holdSnapshot = false;
  private heldSnapshots: (() => void)[] = [];
  syncCalls: SyncRequest[] = [];
  snapshotCalls = 0;
  forbiddenCalls = 0;
  aborted = 0;
  registrations = 0;

  releaseSnapshot() {
    for (const release of this.heldSnapshots.splice(0)) release();
  }

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
    this.snapshotCalls += 1;
    if (this.down)
      throw Object.assign(new Error('fetch failed'), {
        name: 'TRPCClientError',
      });
    if (this.config.mode === 'off') {
      throw Object.assign(new Error('El modo local está apagado'), {
        name: 'TRPCClientError',
        data: { code: 'PRECONDITION_FAILED', httpStatus: 412 },
      });
    }
    // Se arma con el estado de este momento, aunque llegue más tarde.
    const now = new Date(this.clock.server).toISOString();
    const payload: SnapshotPayload = {
      serverNow: now,
      cursor: now,
      config: this.config,
      key: getLegacyQrKeyBase64(),
      events: [{ id: EVENT, name: 'Puerta' }],
      types: this.types(),
      tickets: [...this.tickets.values()].map((t) => this.row(t)),
    };
    if (this.holdSnapshot) {
      await new Promise<void>((resolve) => this.heldSnapshots.push(resolve));
    }
    return payload;
  }

  async sync(
    input: SyncRequest,
    options?: { signal?: AbortSignal },
  ): Promise<SyncPayload> {
    if (this.hang) {
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          this.aborted += 1;
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    }
    if (this.down || this.failSync)
      throw Object.assign(new Error('fetch failed'), {
        name: 'TRPCClientError',
      });
    if (input.eventIds.some((id) => this.forbiddenEvents.has(id))) {
      this.forbiddenCalls += 1;
      throw Object.assign(new Error('No tenés acceso a este evento'), {
        name: 'TRPCClientError',
        data: { code: 'FORBIDDEN', httpStatus: 403 },
      });
    }
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

function makeEngine(
  extra: {
    isOnline?: () => boolean;
    available?: boolean;
    /** Por defecto es la única pestaña (como si el lock ya estuviera). */
    leader?: LeaderState;
  } = {},
) {
  const { leader = 'leader', ...options } = extra;
  const engine = new LocalScanEngine({
    transport: server,
    store,
    userId: USER,
    eventIds: [EVENT],
    deviceId: 'device-1',
    now: clock.device,
    onEvent: (event) => events.push(event),
    ...options,
  });
  engine.setLeader(leader);
  return engine;
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
    await settle(); // termina el intento fallido que disparó la vuelta
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
    engine.setLeader('follower');
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
    // No se suben, pero se avisan: no son de esta sesión ni de otro evento.
    assert.equal(second.getStatus().otherUserPending, 1);
    assert.equal(second.getStatus().pending, 0);
    assert.equal(second.getStatus().foreignPending, 0);
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

describe('vuelta de la red', () => {
  it('corta el pedido colgado y sube lo pendiente al instante', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.hang = true;
    await commit(engine, ana.code);
    assert.equal(
      engine.getStatus().syncing,
      true,
      'el pedido no quedó colgado',
    );

    server.hang = false;
    const startedAt = Date.now();
    await engine.onNetworkBack();
    assert.ok(Date.now() - startedAt < 1_000, 'esperó el timeout');
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.registrations, 1);
    // El corte no cuenta como fallo ni deja backoff.
    assert.equal(engine.getStatus().consecutiveFailures, 0);
    assert.ok(!events.some((e) => e.type === 'sync' && !e.ok));
  });

  it('sin red no intenta ni acumula backoff; al volver sube ya', async () => {
    const ana = server.addTicket('Ana');
    let online = true;
    const engine = makeEngine({ isOnline: () => online });
    await engine.start(server.config, { tick: false });
    online = false;
    const callsBefore = server.syncCalls.length;
    await commit(engine, ana.code);
    for (let i = 0; i < 5; i += 1) {
      clock.advance(1_000);
      await engine.poll();
    }
    assert.equal(server.syncCalls.length, callsBefore, 'intentó sin red');
    assert.equal(engine.getStatus().consecutiveFailures, 0);
    assert.equal(engine.getStatus().pending, 1);
    assert.equal(
      engine.canDecideLocally(),
      true,
      'sin red tiene que seguir decidiendo',
    );

    online = true;
    await engine.onNetworkBack();
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.registrations, 1);
  });

  it('con escaneos pendientes reintenta cada 5 s como mucho', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.down = true;
    await commit(engine, ana.code);
    for (let i = 0; i < 6; i += 1) {
      clock.advance(20_000);
      await engine.poll();
    }
    assert.ok(engine.getStatus().consecutiveFailures >= 4);

    server.down = false;
    clock.advance(PENDING_MAX_BACKOFF_MS);
    await engine.poll();
    assert.equal(engine.getStatus().pending, 0, 'esperó más de 5 s');
  });
});

describe('subidas de otros eventos', () => {
  it('pendientes de otro evento que fallan no frenan esta puerta', async () => {
    const otherEvent = randomUUID();
    const ana = server.addTicket('Ana');
    // Un escaneo de otro evento (ayer) que nunca subió, y al usuario lo
    // desasignaron de ese evento.
    const old = {
      id: randomUUID(),
      code: encryptString(randomUUID()),
      at: clock.server - 86_400_000,
      userId: USER,
      eventIds: [otherEvent],
      hash: 'hash-viejo',
      createdAt: clock.server - 86_400_000,
    };
    store.entries.set(old.id, old);
    server.forbiddenEvents.add(otherEvent);

    const engine = await readyEngine();
    assert.equal(engine.getStatus().foreignPending, 1);
    await commit(engine, ana.code);
    await engine.poll();
    assert.equal(
      server.tickets.get(ana.id)!.scanned,
      true,
      'no subió lo de esta puerta',
    );
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(engine.getStatus().consecutiveFailures, 0);
    assert.equal(engine.canDecideLocally(), true);
    // Lo viejo queda guardado (es un ingreso) y se reintenta de a poco.
    assert.equal(engine.getStatus().foreignPending, 1);
    assert.ok(store.entries.has(old.id));
    const tries = server.forbiddenCalls;
    for (let i = 0; i < 3; i += 1) {
      clock.advance(1_000);
      await engine.poll();
    }
    assert.equal(server.forbiddenCalls, tries, 'reintentó sin esperar');

    // Lo vuelven a asignar: sube.
    server.forbiddenEvents.clear();
    clock.advance(5 * 60_000);
    await engine.poll();
    assert.equal(engine.getStatus().foreignPending, 0);
    assert.ok(!store.entries.has(old.id));
  });
});

describe('tabla que llega tarde', () => {
  it('no deshace un ingreso propio ya confirmado', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    clock.advance(SNAPSHOT_REFRESH_MS);
    await engine.poll(); // toca recargar la tabla
    server.holdSnapshot = true;
    // La tabla se arma ahora (Ana sin escanear) y tarda en llegar.
    const refreshing = engine.poll();
    await settle();
    // Mientras tanto Ana entra por este celular y se confirma.
    await commit(engine, ana.code);
    await engine.poll();
    assert.equal(engine.getStatus().pending, 0);
    assert.equal(server.registrations, 1);

    server.holdSnapshot = false;
    server.releaseSnapshot();
    await refreshing;
    const again = await engine.evaluate(ana.code);
    assert.equal(
      again.kind === 'known' && again.decision.status,
      'already-scanned',
      'la tabla vieja la dejó entrar de nuevo',
    );
  });

  it('no deshace un ingreso de otro celular que llegó en las novedades', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    clock.advance(SNAPSHOT_REFRESH_MS);
    await engine.poll();
    server.holdSnapshot = true;
    const refreshing = engine.poll();
    await settle();
    server.scanElsewhere(ana.id);
    clock.advance(11_000);
    await engine.poll(); // las novedades traen el ingreso
    server.holdSnapshot = false;
    server.releaseSnapshot();
    await refreshing;
    const again = await engine.evaluate(ana.code);
    assert.equal(
      again.kind === 'known' && again.decision.status,
      'already-scanned',
    );
  });

  it('al reabrir con pendientes, la tabla que llega después de subirlos los mantiene', async () => {
    const ana = server.addTicket('Ana');
    const first = await readyEngine();
    server.down = true;
    await commit(first, ana.code);
    first.stop();

    server.down = false;
    server.holdSnapshot = true;
    const second = makeEngine();
    // Pide la tabla (Ana sin escanear en el servidor) y queda en camino.
    const starting = second.start(server.config, { tick: false });
    await settle();
    await second.poll(); // mientras tanto sube el pendiente
    assert.equal(server.registrations, 1);
    assert.equal(second.getStatus().pending, 0);

    server.holdSnapshot = false;
    server.releaseSnapshot();
    await starting;
    const again = await second.evaluate(ana.code);
    assert.equal(
      again.kind === 'known' && again.decision.status,
      'already-scanned',
    );
  });

  it('multiescaneo: los escaneos sin subir siguen contando al recargar', async () => {
    const pulsera = server.addTicket('Pulsera', MULTI_TYPE);
    server.scanElsewhere(pulsera.id);
    server.scanElsewhere(pulsera.id); // 2 en el servidor
    const engine = await readyEngine();
    server.failSync = true;
    await commit(engine, pulsera.code);
    await commit(engine, pulsera.code); // 2 sin subir
    clock.advance(SNAPSHOT_REFRESH_MS);
    await engine.poll(); // toca recargar
    await engine.poll(); // recarga: el servidor dice 2
    assert.ok(server.snapshotCalls >= 2, 'no recargó');
    const evaluation = await engine.evaluate(pulsera.code);
    assert.ok(evaluation.kind === 'known');
    assert.equal(evaluation.ticket.scanCount, 4);
    assert.deepEqual(evaluation.decision, { status: 'success', scanNumber: 5 });
  });

  it('multiescaneo: al reabrir con pendientes, la tabla nueva los cuenta', async () => {
    const pulsera = server.addTicket('Pulsera', MULTI_TYPE);
    server.scanElsewhere(pulsera.id);
    const first = await readyEngine();
    server.failSync = true;
    await commit(first, pulsera.code);
    first.stop();

    const second = makeEngine();
    await second.start(server.config, { tick: false });
    const evaluation = await second.evaluate(pulsera.code);
    assert.ok(evaluation.kind === 'known');
    assert.equal(evaluation.ticket.scanCount, 2);
  });
});

describe('modo apagado', () => {
  it('no pide la tabla una y otra vez después del botón de apagado', async () => {
    const ana = server.addTicket('Ana');
    server.addTicket('Beto');
    const engine = await readyEngine();
    // Se borra una entrada (toca recargar la tabla) y justo apagan el modo.
    server.tickets.delete(ana.id);
    server.config = { mode: 'off', maxStaleSeconds: 60 };
    clock.advance(11_000);
    await engine.poll();
    assert.equal(engine.getStatus().mode, 'off');
    const calls = server.snapshotCalls;
    for (let i = 0; i < 10; i += 1) {
      clock.advance(60_000);
      await engine.poll();
    }
    assert.equal(
      server.snapshotCalls,
      calls,
      'pidió la tabla con el modo apagado',
    );
  });

  it('si rechazan la tabla porque el modo se apagó, queda en normal sin reintentar', async () => {
    server.addTicket('Ana');
    server.config = { mode: 'off', maxStaleSeconds: 60 };
    const engine = makeEngine();
    // El celular arrancó con la configuración vieja (rápido).
    await engine.start({ mode: 'local', maxStaleSeconds: 60 }, { tick: false });
    assert.equal(engine.getStatus().mode, 'off');
    assert.equal(engine.getStatus().phase, 'idle');
    const calls = server.snapshotCalls;
    for (let i = 0; i < 5; i += 1) {
      clock.advance(60_000);
      await engine.poll();
    }
    assert.equal(server.snapshotCalls, calls);
  });

  it('se entera cuando lo prenden, sin recargar la página', async () => {
    const ana = server.addTicket('Ana');
    server.config = { mode: 'off', maxStaleSeconds: 60 };
    const engine = makeEngine();
    await engine.start(server.config, { tick: false });
    assert.equal(engine.getStatus().mode, 'off');

    server.config = { mode: 'local', maxStaleSeconds: 60 };
    clock.advance(CONFIG_CHECK_MS);
    await engine.poll(); // pregunta la configuración
    await engine.poll(); // baja la tabla
    assert.equal(engine.getStatus().mode, 'local');
    assert.equal(engine.getStatus().phase, 'ready');
    assert.equal((await engine.evaluate(ana.code)).kind, 'known');
  });

  it('sin el modo local en la instalación no pregunta la configuración', async () => {
    server.config = { mode: 'off', maxStaleSeconds: 60 };
    const engine = makeEngine({ available: false });
    await engine.start(server.config, { tick: false });
    for (let i = 0; i < 5; i += 1) {
      clock.advance(CONFIG_CHECK_MS);
      await engine.poll();
    }
    assert.equal(server.syncCalls.length, 0);
  });
});

describe('red que cambia seguido', () => {
  it('avisos de cambio de red seguidos no cortan una y otra vez', async () => {
    const ana = server.addTicket('Ana');
    const engine = await readyEngine();
    server.hang = true;
    await commit(engine, ana.code); // el pedido queda colgado
    void engine.onNetworkBack(); // corta y reintenta (se vuelve a colgar)
    await settle();
    assert.equal(server.aborted, 1);

    clock.advance(1_000);
    await engine.onNetworkBack(); // otro aviso enseguida
    await settle();
    assert.equal(server.aborted, 1, 'volvió a cortar enseguida');

    clock.advance(NETWORK_RESET_MIN_MS);
    void engine.onNetworkBack();
    await settle();
    assert.equal(server.aborted, 2);
    engine.stop();
  });
});

describe('una sola pestaña decide', () => {
  it('hasta saber si es la única pestaña no decide; sin Web Locks, tampoco', async () => {
    server.addTicket('Ana');
    const engine = makeEngine({ leader: 'unknown' });
    await engine.start(server.config, { tick: false });
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'claiming');
    engine.setLeader('unsupported');
    assert.equal(engine.canDecideLocally(), false);
    assert.equal(engine.getStatus().staleReason, 'no-locks');
    engine.setLeader('leader');
    assert.equal(engine.canDecideLocally(), true);
  });

  it('en modo sombra la pestaña no importa', async () => {
    server.addTicket('Ana');
    server.config = { mode: 'shadow', maxStaleSeconds: 60 };
    const engine = makeEngine({ leader: 'unknown' });
    await engine.start(server.config, { tick: false });
    assert.equal(engine.getStatus().staleReason, null);
  });
});
