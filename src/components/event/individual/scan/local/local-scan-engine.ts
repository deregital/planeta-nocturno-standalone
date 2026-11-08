import {
  type OutboxEntry,
  type OutboxStore,
} from '@/components/event/individual/scan/local/outbox-store';
import {
  decideKnownTicket,
  type KnownTicketDecision,
} from '@/lib/scan/decision';
import { decryptLegacyQr, importLegacyQrKey } from '@/lib/scan/legacy-qr';
import {
  MAX_SYNC_SCANS,
  minMode,
  OFF_CONFIG,
  SCANNER_PROTOCOL_VERSION,
  type DeltaScanRow,
  type ScannerConfig,
  type ScannerMode,
  type SnapshotTicketRow,
  type SnapshotTicketType,
  type SyncScanOutcome,
} from '@/lib/scan/protocol';
import { ticketHash } from '@/lib/scan/ticket-hash';

/**
 * Motor del escaneo con decisión local: la tabla de la puerta en memoria, la
 * cola de escaneos sin confirmar y la sincronización con el servidor. No
 * depende de React ni del navegador (salvo WebCrypto) para poder probarlo.
 */

export type SnapshotPayload = {
  serverNow: string;
  cursor: string;
  config: ScannerConfig;
  key: string;
  events: { id: string; name: string }[];
  types: SnapshotTicketType[];
  tickets: SnapshotTicketRow[];
};

export type SyncPayload = {
  serverNow: string;
  cursor: string;
  config: ScannerConfig;
  results: {
    id: string;
    outcome: SyncScanOutcome;
    hash: string | null;
    scannedAt: string | null;
    scannedByMe: boolean;
  }[];
  delta: {
    scans: DeltaScanRow[];
    added: SnapshotTicketRow[];
    types: SnapshotTicketType[];
    ticketCount: number;
  } | null;
};

export type SyncRequest = {
  protocol: typeof SCANNER_PROTOCOL_VERSION;
  eventIds: string[];
  deviceId: string;
  cursor: string | null;
  scans: { id: string; code: string; at: number }[];
};

export interface ScannerTransport {
  snapshot(
    input: { protocol: typeof SCANNER_PROTOCOL_VERSION; eventIds: string[] },
    options: { signal: AbortSignal },
  ): Promise<SnapshotPayload>;
  sync(
    input: SyncRequest,
    options: { signal: AbortSignal },
  ): Promise<SyncPayload>;
}

export type LocalTicket = {
  hash: string;
  eventId: string;
  typeId: string;
  fullName: string;
  dniTail: string;
  invitedBy: string | null;
  scanned: boolean;
  scannedAt: string | null;
  scanCount: number;
};

export type Evaluation =
  | { kind: 'unavailable' }
  | { kind: 'unreadable' }
  | { kind: 'unknown'; ticketId: string; hash: string }
  | {
      kind: 'known';
      ticketId: string;
      hash: string;
      ticket: LocalTicket;
      type: SnapshotTicketType | undefined;
      eventName: string;
      decision: KnownTicketDecision;
    };

export type StaleReason =
  | 'loading'
  | 'never-synced'
  | 'stale-pull'
  | 'stale-push'
  | 'resync-after-wake'
  | 'not-leader'
  | 'storage'
  | 'snapshot-error';

export type EngineStatus = {
  /** Modo pedido (el más conservador entre el evento y el celular). */
  mode: ScannerMode;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  /** ¿Puede decidir en el celular ahora mismo? */
  canDecide: boolean;
  staleReason: StaleReason | null;
  pending: number;
  /** Pendientes de otra sesión de este celular (otro usuario). */
  foreignPending: number;
  lastSyncAt: number | null;
  tickets: number;
  leader: boolean;
  storageOk: boolean;
  syncing: boolean;
  consecutiveFailures: number;
  lastError: string | null;
  maxStaleSeconds: number;
};

export type EngineEvent =
  | {
      type: 'conflict';
      outcome: Exclude<SyncScanOutcome, 'registered'>;
      fullName: string | null;
      scannedAt: string | null;
      scannedByMe: boolean;
    }
  | {
      type: 'sync';
      ok: boolean;
      latencyMs: number;
      pushed: number;
      pendingAfter: number;
      errorCode?: string;
    }
  | { type: 'snapshot'; ok: boolean; latencyMs: number; tickets: number };

export const SYNC_TIMEOUT_MS = 12_000;
export const SNAPSHOT_TIMEOUT_MS = 45_000;
export const PULL_INTERVAL_MS = 10_000;
export const SNAPSHOT_REFRESH_MS = 5 * 60_000;
const MAX_BACKOFF_MS = 15_000;
/** Con escaneos sin subir se reintenta más seguido: son ingresos sin confirmar. */
export const PENDING_MAX_BACKOFF_MS = 5_000;
const RECENT_LOCAL_MS = 60_000;
/** Motivo del corte de lo que estaba en vuelo cuando vuelve o cambia la red. */
const NETWORK_CHANGED = 'network-changed';

function browserOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** TIMEOUT (lo cortó el celular), el código de tRPC, o NETWORK si no llegó. */
function errorCode(error: unknown) {
  const e = error as {
    name?: string;
    cause?: { name?: string };
    data?: { code?: string };
  };
  if (e?.name === 'AbortError' || e?.cause?.name === 'AbortError') {
    return 'TIMEOUT';
  }
  if (e?.data?.code) return e.data.code;
  if (e?.name === 'TRPCClientError') return 'NETWORK';
  return e?.name || 'ERROR';
}

function sameEvents(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function toLocalTicket(row: SnapshotTicketRow): LocalTicket {
  const [
    hash,
    eventId,
    typeId,
    fullName,
    dniTail,
    invitedBy,
    scanned,
    scannedAt,
    scanCount,
  ] = row;
  return {
    hash,
    eventId,
    typeId,
    fullName,
    dniTail,
    invitedBy,
    scanned,
    scannedAt,
    scanCount,
  };
}

export class LocalScanEngine {
  private readonly transport: ScannerTransport;
  private readonly store: OutboxStore;
  private readonly now: () => number;
  private readonly isOnline: () => boolean;
  private readonly userId: string;
  private readonly eventIds: string[];
  private readonly deviceId: string;
  private readonly onEvent: (event: EngineEvent) => void;

  private serverConfig: ScannerConfig = OFF_CONFIG;
  private deviceMode: ScannerMode = 'local';
  private deviceMaxStale: number | null = null;

  private phase: EngineStatus['phase'] = 'idle';
  private key: CryptoKey | null = null;
  private table = new Map<string, LocalTicket>();
  private types = new Map<string, SnapshotTicketType>();
  private events = new Map<string, string>();
  private cursor: string | null = null;
  private offsetMs = 0;
  private lastPullServerAt: number | null = null;
  private lastSyncAt: number | null = null;
  private lastSnapshotAt: number | null = null;
  private needsResync = false;
  private leader = true;
  private storageOk = true;

  private pending = new Map<string, OutboxEntry>();
  private foreign: OutboxEntry[] = [];
  private recentLocal = new Map<string, number>();

  private syncing = false;
  private syncRun: Promise<void> | null = null;
  private snapshotRun: Promise<void> | null = null;
  private snapshotLoading = false;
  private snapshotWanted = false;
  private lastSyncAttemptAt = 0;
  private nextAttemptAt = 0;
  private consecutiveFailures = 0;
  private lastError: string | null = null;
  private snapshotFailures = 0;
  private nextSnapshotAt = 0;

  private stopped = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inflight = new Set<AbortController>();
  private listeners = new Set<() => void>();
  private status: EngineStatus;

  constructor(options: {
    transport: ScannerTransport;
    store: OutboxStore;
    userId: string;
    eventIds: string[];
    deviceId: string;
    now?: () => number;
    /** Si el navegador sabe que no hay red, no se intenta (ni suma backoff). */
    isOnline?: () => boolean;
    onEvent?: (event: EngineEvent) => void;
  }) {
    this.transport = options.transport;
    this.store = options.store;
    this.userId = options.userId;
    this.eventIds = [...options.eventIds].sort();
    this.deviceId = options.deviceId;
    this.now = options.now ?? Date.now;
    this.isOnline = options.isOnline ?? browserOnline;
    this.onEvent = options.onEvent ?? (() => {});
    this.status = this.computeStatus();
  }

  // ---------------------------------------------------------------- ciclo

  /**
   * `serverConfig` es la del evento (de `scanner.config`); después la
   * actualiza cada sincronización, así el botón de apagado llega solo.
   */
  async start(serverConfig: ScannerConfig, { tick = true } = {}) {
    this.serverConfig = serverConfig;
    await this.loadOutbox();
    if (this.mode !== 'off') this.snapshotWanted = true;
    if (tick) {
      this.timer = setInterval(() => void this.poll(), 1_000);
    }
    await this.poll();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    for (const controller of this.inflight) controller.abort();
    this.inflight.clear();
    this.listeners.clear();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = () => this.status;

  /** Configuración del celular: puede bajar el modo o N del evento, nunca subirlos. */
  setDeviceLimits(mode: ScannerMode, maxStaleSeconds: number | null) {
    const wasOff = this.mode === 'off';
    this.deviceMode = mode;
    this.deviceMaxStale = maxStaleSeconds;
    if (wasOff && this.mode !== 'off' && this.phase !== 'ready') {
      this.snapshotWanted = true;
    }
    this.notify();
  }

  setServerConfig(config: ScannerConfig) {
    const wasOff = this.mode === 'off';
    this.serverConfig = config;
    if (wasOff && this.mode !== 'off' && this.phase !== 'ready') {
      this.snapshotWanted = true;
    }
    this.notify();
  }

  setLeader(leader: boolean) {
    this.leader = leader;
    this.notify();
  }

  /** La pestaña vuelve a primer plano: hasta sincronizar, no decide sola. */
  onVisible() {
    this.needsResync = true;
    this.nextAttemptAt = 0;
    this.notify();
    void this.poll();
  }

  /**
   * Volvió la red o cambió (wifi ↔ datos). Lo que estaba en vuelo salió por la
   * red anterior y puede quedar colgado hasta el timeout (12 s), y después del
   * último fallo había que esperar el backoff: se corta y se reintenta ya. Los
   * reintentos son idempotentes (`clientScanId`), así que cortar no duplica.
   */
  async onNetworkBack() {
    if (this.stopped) return;
    for (const controller of this.inflight) controller.abort(NETWORK_CHANGED);
    await Promise.all([this.syncRun, this.snapshotRun]);
    this.nextAttemptAt = 0;
    this.nextSnapshotAt = 0;
    await this.poll();
  }

  get mode(): ScannerMode {
    return minMode(this.serverConfig.mode, this.deviceMode);
  }

  private get maxStaleMs() {
    const device = this.deviceMaxStale ?? Number.POSITIVE_INFINITY;
    return Math.min(this.serverConfig.maxStaleSeconds, device) * 1000;
  }

  /** Hora del servidor estimada. */
  correctedNow() {
    return this.now() + this.offsetMs;
  }

  /** Un paso del ciclo: recarga la tabla y sincroniza si toca. Corre cada segundo. */
  async poll() {
    if (this.stopped) return;
    // Sin red no se intenta: fallaría al instante y el backoff atrasaría el
    // primer intento cuando vuelva (`onNetworkBack`).
    if (!this.isOnline()) {
      this.notify();
      return;
    }
    const now = this.now();

    if (
      this.snapshotWanted &&
      !this.snapshotLoading &&
      now >= this.nextSnapshotAt
    ) {
      this.snapshotRun = this.refreshSnapshot();
      await this.snapshotRun;
    } else if (
      this.phase === 'ready' &&
      this.mode !== 'off' &&
      !this.snapshotLoading &&
      this.lastSnapshotAt !== null &&
      now - this.lastSnapshotAt >= SNAPSHOT_REFRESH_MS
    ) {
      this.snapshotWanted = true;
    }

    if (!this.syncing && now >= this.nextAttemptAt) {
      const hasPending =
        this.ownPending().length > 0 || this.foreign.length > 0;
      const pulling =
        this.mode !== 'off' &&
        this.phase === 'ready' &&
        (this.needsResync || now - this.lastSyncAttemptAt >= PULL_INTERVAL_MS);
      if (hasPending || pulling) {
        this.syncRun = this.runSync();
        await this.syncRun;
      }
    }

    this.notify();
  }

  // ---------------------------------------------------------- decisiones

  /** Sin efectos: qué decidiría el celular para este QR. */
  async evaluate(code: string): Promise<Evaluation> {
    if (!this.key || this.phase !== 'ready') return { kind: 'unavailable' };
    const ticketId = await decryptLegacyQr(code, this.key);
    if (!ticketId) return { kind: 'unreadable' };
    const hash = await ticketHash(ticketId);
    const ticket = this.table.get(hash);
    if (!ticket) return { kind: 'unknown', ticketId, hash };
    const type = this.types.get(ticket.typeId);
    return {
      kind: 'known',
      ticketId,
      hash,
      ticket: { ...ticket },
      type,
      eventName: this.events.get(ticket.eventId) ?? '',
      decision: decideKnownTicket(ticket, type?.allowMultipleScans ?? false),
    };
  }

  /** Se recalcula en el momento: la frescura depende de la hora. */
  canDecideLocally() {
    this.notify();
    return this.status.canDecide;
  }

  /**
   * Registra un ingreso decidido en el celular. Primero queda en disco; si
   * eso falla, lanza y el escaneo tiene que ir por el servidor.
   */
  async commitLocalSuccess(
    evaluation: Extract<Evaluation, { kind: 'known' }>,
    code: string,
  ): Promise<LocalTicket> {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      code,
      at: Math.round(this.correctedNow()),
      userId: this.userId,
      eventIds: this.eventIds,
      hash: evaluation.hash,
      createdAt: this.now(),
    };
    try {
      await this.store.put(entry);
    } catch (error) {
      this.storageOk = false;
      this.notify();
      throw error;
    }

    this.pending.set(entry.id, entry);
    const current = this.table.get(evaluation.hash) ?? evaluation.ticket;
    const updated: LocalTicket = {
      ...current,
      scanned: true,
      scannedAt: new Date(entry.at).toISOString(),
      scanCount: current.scanCount + 1,
    };
    this.table.set(evaluation.hash, updated);
    this.recentLocal.set(evaluation.ticketId, this.now());
    this.nextAttemptAt = Math.min(this.nextAttemptAt, this.now());
    this.notify();
    void this.poll();
    return updated;
  }

  /** ¿Este celular registró esta entrada en el último minuto (modo local)? */
  recentLocalSuccessAt(ticketId: string): number | undefined {
    const at = this.recentLocal.get(ticketId);
    if (at === undefined) return undefined;
    if (this.now() - at > RECENT_LOCAL_MS) {
      this.recentLocal.delete(ticketId);
      return undefined;
    }
    return at;
  }

  /** Un escaneo que fue por el servidor (online, sombra o desconocido) actualiza la tabla. */
  async applyServerScan(
    ticketId: string,
    status: string,
    scannedAt: string | null,
  ) {
    if (this.table.size === 0) return;
    const hash = await ticketHash(ticketId);
    const current = this.table.get(hash);
    if (!current) return;
    if (status === 'success') {
      this.table.set(hash, {
        ...current,
        scanned: true,
        scannedAt: scannedAt ?? current.scannedAt,
        scanCount: current.scanCount + 1,
      });
    } else if (status === 'already-scanned' && !current.scanned) {
      this.table.set(hash, { ...current, scanned: true, scannedAt });
    }
  }

  lookupName(hash: string | null) {
    return hash ? (this.table.get(hash)?.fullName ?? null) : null;
  }

  // -------------------------------------------------------------- sync

  private ownPending() {
    return [...this.pending.values()]
      .filter((entry) => sameEvents(entry.eventIds, this.eventIds))
      .sort((a, b) => a.at - b.at);
  }

  private async loadOutbox() {
    try {
      const entries = await this.store.list();
      for (const entry of entries) {
        if (entry.userId !== this.userId) continue;
        if (sameEvents(entry.eventIds, this.eventIds)) {
          this.pending.set(entry.id, entry);
        } else {
          this.foreign.push(entry);
        }
      }
      this.storageOk = true;
    } catch {
      this.storageOk = false;
    }
  }

  /** Merge monótono: una entrada escaneada nunca vuelve a "sin escanear". */
  private mergeTicket(hash: string, incoming: Partial<LocalTicket>) {
    const current = this.table.get(hash);
    if (!current) return;
    this.table.set(hash, {
      ...current,
      scanned: current.scanned || Boolean(incoming.scanned),
      scannedAt: incoming.scannedAt ?? current.scannedAt,
      scanCount: Math.max(current.scanCount, incoming.scanCount ?? 0),
    });
  }

  private applyTypes(types: SnapshotTicketType[]) {
    for (const type of types) this.types.set(type.id, type);
  }

  private reapplyPendingMarks() {
    for (const entry of this.pending.values()) {
      const current = this.table.get(entry.hash);
      if (current && !current.scanned) {
        this.table.set(entry.hash, {
          ...current,
          scanned: true,
          scannedAt: new Date(entry.at).toISOString(),
          scanCount: current.scanCount + 1,
        });
      }
    }
  }

  private updateOffset(serverNow: string, sentAt: number, receivedAt: number) {
    const server = Date.parse(serverNow);
    if (!Number.isNaN(server)) {
      this.offsetMs = server - (sentAt + receivedAt) / 2;
    }
  }

  private async refreshSnapshot() {
    this.snapshotLoading = true;
    this.snapshotWanted = false;
    if (this.phase !== 'ready') this.phase = 'loading';
    this.notify();

    const controller = new AbortController();
    this.inflight.add(controller);
    const timeout = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
    const sentAt = this.now();
    try {
      const snapshot = await this.transport.snapshot(
        { protocol: SCANNER_PROTOCOL_VERSION, eventIds: this.eventIds },
        { signal: controller.signal },
      );
      if (this.stopped) return;
      const receivedAt = this.now();
      this.key = await importLegacyQrKey(snapshot.key);
      this.updateOffset(snapshot.serverNow, sentAt, receivedAt);
      this.table = new Map(
        snapshot.tickets.map((row) => [row[0], toLocalTicket(row)]),
      );
      this.types = new Map();
      this.applyTypes(snapshot.types);
      this.events = new Map(snapshot.events.map((e) => [e.id, e.name]));
      this.reapplyPendingMarks();
      this.cursor = snapshot.cursor;
      this.lastPullServerAt = Date.parse(snapshot.serverNow);
      this.lastSnapshotAt = receivedAt;
      this.needsResync = false;
      this.serverConfig = snapshot.config;
      this.phase = 'ready';
      this.snapshotFailures = 0;
      this.onEvent({
        type: 'snapshot',
        ok: true,
        latencyMs: receivedAt - sentAt,
        tickets: snapshot.tickets.length,
      });
    } catch (error) {
      if (this.stopped) return;
      this.snapshotWanted = true;
      if (controller.signal.reason === NETWORK_CHANGED) {
        // Se cortó a propósito para reintentar por la red nueva.
        this.nextSnapshotAt = 0;
        return;
      }
      this.snapshotFailures += 1;
      this.nextSnapshotAt =
        this.now() + Math.min(60_000, 5_000 * 2 ** (this.snapshotFailures - 1));
      if (this.phase !== 'ready') this.phase = 'error';
      this.lastError = errorCode(error);
      this.onEvent({
        type: 'snapshot',
        ok: false,
        latencyMs: this.now() - sentAt,
        tickets: 0,
      });
    } finally {
      clearTimeout(timeout);
      this.inflight.delete(controller);
      this.snapshotLoading = false;
      this.notify();
    }
  }

  private async flushForeign() {
    // Pendientes de otra puerta (otros eventos) del mismo usuario: se suben
    // con sus propios eventos, sin pedir novedades.
    const groups = new Map<string, OutboxEntry[]>();
    for (const entry of this.foreign) {
      const key = [...entry.eventIds].sort().join(',');
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    for (const entries of groups.values()) {
      const batch = entries.slice(0, MAX_SYNC_SCANS);
      const controller = new AbortController();
      this.inflight.add(controller);
      const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
      try {
        const response = await this.transport.sync(
          {
            protocol: SCANNER_PROTOCOL_VERSION,
            eventIds: batch[0].eventIds,
            deviceId: this.deviceId,
            cursor: null,
            scans: batch.map(({ id, code, at }) => ({ id, code, at })),
          },
          { signal: controller.signal },
        );
        const acked = new Set(response.results.map((r) => r.id));
        await this.store.remove([...acked]).catch(() => {});
        this.foreign = this.foreign.filter((entry) => !acked.has(entry.id));
      } finally {
        clearTimeout(timeout);
        this.inflight.delete(controller);
      }
    }
  }

  private async runSync() {
    this.syncing = true;
    this.lastSyncAttemptAt = this.now();
    this.notify();

    const batch = this.ownPending().slice(0, MAX_SYNC_SCANS);
    const controller = new AbortController();
    this.inflight.add(controller);
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
    const sentAt = this.now();
    try {
      if (this.foreign.length > 0) await this.flushForeign();

      const pulling = this.mode !== 'off' && this.phase === 'ready';
      if (batch.length === 0 && !pulling) return;

      const response = await this.transport.sync(
        {
          protocol: SCANNER_PROTOCOL_VERSION,
          eventIds: this.eventIds,
          deviceId: this.deviceId,
          cursor: pulling ? this.cursor : null,
          scans: batch.map(({ id, code, at }) => ({ id, code, at })),
        },
        { signal: controller.signal },
      );
      if (this.stopped) return;
      const receivedAt = this.now();
      this.updateOffset(response.serverNow, sentAt, receivedAt);

      const acked: string[] = [];
      for (const result of response.results) {
        if (!this.pending.has(result.id)) continue;
        acked.push(result.id);
        this.pending.delete(result.id);
        if (result.outcome === 'registered' && result.hash) {
          this.mergeTicket(result.hash, {
            scanned: true,
            scannedAt: result.scannedAt,
          });
        } else if (result.outcome !== 'registered') {
          this.onEvent({
            type: 'conflict',
            outcome: result.outcome,
            fullName: this.lookupName(result.hash),
            scannedAt: result.scannedAt,
            scannedByMe: result.scannedByMe,
          });
        }
      }
      // Si borrar falla, se vuelven a subir y el servidor responde lo mismo.
      await this.store.remove(acked).catch(() => {});

      if (response.delta && this.phase === 'ready') {
        for (const [hash, scanned, scannedAt, scanCount] of response.delta
          .scans) {
          this.mergeTicket(hash, { scanned, scannedAt, scanCount });
        }
        for (const row of response.delta.added) {
          if (!this.table.has(row[0]))
            this.table.set(row[0], toLocalTicket(row));
          else this.mergeTicket(row[0], toLocalTicket(row));
        }
        this.applyTypes(response.delta.types);
        this.reapplyPendingMarks();
        // Otro total: se borraron (o faltan) entradas. La tabla se recarga.
        if (response.delta.ticketCount !== this.table.size) {
          this.snapshotWanted = true;
        }
      }

      if (pulling) {
        this.cursor = response.cursor;
        this.lastPullServerAt = Date.parse(response.serverNow);
        this.needsResync = false;
      }
      this.lastSyncAt = receivedAt;
      this.setServerConfigFromSync(response.config);
      this.consecutiveFailures = 0;
      this.lastError = null;
      this.nextAttemptAt = 0;
      this.onEvent({
        type: 'sync',
        ok: true,
        latencyMs: receivedAt - sentAt,
        pushed: acked.length,
        pendingAfter: this.ownPending().length,
      });
    } catch (error) {
      if (this.stopped) return;
      if (controller.signal.reason === NETWORK_CHANGED) {
        // Se cortó a propósito para reintentar por la red nueva.
        this.nextAttemptAt = 0;
        return;
      }
      this.consecutiveFailures += 1;
      this.lastError = errorCode(error);
      const cap =
        this.ownPending().length > 0 ? PENDING_MAX_BACKOFF_MS : MAX_BACKOFF_MS;
      this.nextAttemptAt =
        this.now() +
        Math.min(cap, 1_000 * 2 ** Math.min(4, this.consecutiveFailures));
      this.onEvent({
        type: 'sync',
        ok: false,
        latencyMs: this.now() - sentAt,
        pushed: 0,
        pendingAfter: this.ownPending().length,
        errorCode: this.lastError,
      });
    } finally {
      clearTimeout(timeout);
      this.inflight.delete(controller);
      this.syncing = false;
      this.notify();
    }
  }

  private setServerConfigFromSync(config: ScannerConfig) {
    const wasOff = this.mode === 'off';
    this.serverConfig = config;
    if (wasOff && this.mode !== 'off' && this.phase !== 'ready') {
      this.snapshotWanted = true;
    }
  }

  // ------------------------------------------------------------- estado

  private staleReason(): StaleReason | null {
    if (this.phase === 'error') return 'snapshot-error';
    if (this.phase !== 'ready') return 'loading';
    if (!this.storageOk) return 'storage';
    if (!this.leader) return 'not-leader';
    if (this.needsResync) return 'resync-after-wake';
    if (this.lastPullServerAt === null) return 'never-synced';
    const now = this.correctedNow();
    if (now - this.lastPullServerAt > this.maxStaleMs) return 'stale-pull';
    const oldest = this.ownPending()[0];
    if (oldest && now - oldest.at > this.maxStaleMs) return 'stale-push';
    return null;
  }

  private computeStatus(): EngineStatus {
    const staleReason = this.staleReason();
    return {
      mode: this.mode,
      phase: this.phase,
      canDecide: this.mode === 'local' && staleReason === null,
      staleReason,
      pending: this.ownPending().length,
      foreignPending: this.foreign.length,
      lastSyncAt: this.lastSyncAt,
      tickets: this.table.size,
      leader: this.leader,
      storageOk: this.storageOk,
      syncing: this.syncing,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      maxStaleSeconds: Math.round(this.maxStaleMs / 1000),
    };
  }

  private notify() {
    const next = this.computeStatus();
    const prev = this.status;
    const changed = (Object.keys(next) as (keyof EngineStatus)[]).some(
      (key) => next[key] !== prev[key],
    );
    if (!changed) return;
    this.status = next;
    for (const listener of this.listeners) listener();
  }
}
