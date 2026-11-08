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
  /** Todavía no se sabe si esta pestaña es la única que decide. */
  | 'claiming'
  | 'not-leader'
  /** El navegador no puede asegurar una sola pestaña (sin Web Locks). */
  | 'no-locks'
  | 'storage'
  | 'snapshot-error';

/**
 * Si esta pestaña es la única del celular que decide sola (Web Locks).
 * `unknown` hasta que el navegador lo confirma: mientras tanto no decide.
 */
export type LeaderState = 'unknown' | 'leader' | 'follower' | 'unsupported';

export type EngineStatus = {
  /** Modo pedido (el más conservador entre el evento y el celular). */
  mode: ScannerMode;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  /** ¿Puede decidir en el celular ahora mismo? */
  canDecide: boolean;
  staleReason: StaleReason | null;
  pending: number;
  /** Pendientes de este usuario en otros eventos (se suben aparte). */
  foreignPending: number;
  /**
   * Pendientes de otro usuario que usó este celular. No se pueden subir con
   * esta sesión (quedarían a nombre de otro): se avisan.
   */
  otherUserPending: number;
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
/**
 * Con el modo del evento apagado no se sincroniza: cada tanto se pregunta la
 * configuración para que prender el modo llegue sin recargar la página.
 */
export const CONFIG_CHECK_MS = 30_000;
/** Los pendientes de otros eventos que fallan no frenan la puerta: se reintentan de a poco. */
export const FOREIGN_MAX_BACKOFF_MS = 5 * 60_000;
/**
 * Un cambio de red corta lo que estaba en vuelo como mucho cada tanto: si el
 * aviso se repite, no hay que reiniciar una y otra vez una bajada que avanza.
 */
export const NETWORK_RESET_MIN_MS = 5_000;
const RECENT_LOCAL_MS = 60_000;
/** Motivo del corte de lo que estaba en vuelo cuando vuelve o cambia la red. */
const NETWORK_CHANGED = 'network-changed';

/** false solo si el navegador sabe que no hay red (modo avión, sin wifi ni datos). */
export function isBrowserOnline() {
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

/** La más reciente de dos horas ISO (null si no hay ninguna). */
function laterIso(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
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

/**
 * Merge monótono del estado de escaneo: una entrada escaneada nunca vuelve a
 * "sin escanear" y la cantidad de escaneos no baja. Nada en el sistema
 * desmarca un escaneo, así que lo que ya se sabe no se pierde por una foto
 * más vieja del servidor (una tabla que tardó en bajar).
 */
function mergeScanState(
  base: LocalTicket,
  other: Pick<LocalTicket, 'scanned' | 'scannedAt' | 'scanCount'>,
): LocalTicket {
  return {
    ...base,
    scanned: base.scanned || other.scanned,
    scannedAt: laterIso(base.scannedAt, other.scannedAt),
    scanCount: Math.max(base.scanCount, other.scanCount),
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
  /** La instalación tiene el modo local: si no, no se pregunta la configuración. */
  private readonly available: boolean;

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
  private leaderState: LeaderState = 'unknown';
  private storageOk = true;

  /** Pendientes de este usuario y estos eventos (los únicos que se deciden acá). */
  private pending = new Map<string, OutboxEntry>();
  private foreign: OutboxEntry[] = [];
  private otherUserPending = 0;
  private recentLocal = new Map<string, number>();
  /**
   * Escaneos propios confirmados hace poco. Una tabla que empezó a bajar
   * antes de que se confirmaran puede no tenerlos: se vuelven a marcar.
   */
  private recentAcked = new Map<
    string,
    { hash: string; at: number; ackedAt: number }
  >();

  private syncing = false;
  private syncRun: Promise<void> | null = null;
  private snapshotRun: Promise<void> | null = null;
  private snapshotLoading = false;
  private snapshotWanted = false;
  private lastSyncAttemptAt = 0;
  private lastConfigCheckAt = 0;
  private nextAttemptAt = 0;
  private consecutiveFailures = 0;
  private lastError: string | null = null;
  private snapshotFailures = 0;
  private nextSnapshotAt = 0;
  private foreignFailures = 0;
  private foreignRetryAt = 0;
  private lastNetworkResetAt = Number.NEGATIVE_INFINITY;

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
    /** La instalación tiene el modo local (`scanner.config` → `available`). */
    available?: boolean;
    onEvent?: (event: EngineEvent) => void;
  }) {
    this.transport = options.transport;
    this.store = options.store;
    this.userId = options.userId;
    this.eventIds = [...options.eventIds].sort();
    this.deviceId = options.deviceId;
    this.now = options.now ?? Date.now;
    this.isOnline = options.isOnline ?? isBrowserOnline;
    this.available = options.available ?? true;
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
    // La configuración se acaba de leer: la próxima consulta, en un rato.
    this.lastConfigCheckAt = this.now();
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

  setLeader(state: LeaderState) {
    this.leaderState = state;
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
   * Como mucho un corte cada NETWORK_RESET_MIN_MS.
   */
  async onNetworkBack() {
    if (this.stopped) return;
    const now = this.now();
    if (now - this.lastNetworkResetAt >= NETWORK_RESET_MIN_MS) {
      this.lastNetworkResetAt = now;
      for (const controller of this.inflight) {
        controller.abort(NETWORK_CHANGED);
      }
      await Promise.all([this.syncRun, this.snapshotRun]);
    }
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
      // Con el modo apagado no se baja la tabla (el servidor la rechaza).
      this.mode !== 'off' &&
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
        this.pending.size > 0 ||
        (this.foreign.length > 0 && now >= this.foreignRetryAt);
      if (hasPending || this.isPullDue(now) || this.isConfigCheckDue(now)) {
        this.syncRun = this.runSync();
        await this.syncRun;
      }
    }

    this.notify();
  }

  private isPullDue(now: number) {
    return (
      this.mode !== 'off' &&
      this.phase === 'ready' &&
      (this.needsResync || now - this.lastSyncAttemptAt >= PULL_INTERVAL_MS)
    );
  }

  private isConfigCheckDue(now: number) {
    return (
      this.available &&
      this.serverConfig.mode === 'off' &&
      now - this.lastConfigCheckAt >= CONFIG_CHECK_MS
    );
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
        scannedAt: laterIso(current.scannedAt, scannedAt),
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

  /** Pendientes propios, del más viejo al más nuevo. */
  private ownPending() {
    return [...this.pending.values()].sort((a, b) => a.at - b.at);
  }

  private oldestPendingAt() {
    let oldest: number | null = null;
    for (const entry of this.pending.values()) {
      if (oldest === null || entry.at < oldest) oldest = entry.at;
    }
    return oldest;
  }

  private async loadOutbox() {
    try {
      const entries = await this.store.list();
      let otherUser = 0;
      for (const entry of entries) {
        if (entry.userId !== this.userId) {
          otherUser += 1;
        } else if (sameEvents(entry.eventIds, this.eventIds)) {
          this.pending.set(entry.id, entry);
        } else {
          this.foreign.push(entry);
        }
      }
      this.otherUserPending = otherUser;
      this.storageOk = true;
    } catch {
      this.storageOk = false;
    }
  }

  private mergeTicket(
    hash: string,
    incoming: Pick<LocalTicket, 'scanned' | 'scannedAt' | 'scanCount'>,
  ) {
    const current = this.table.get(hash);
    if (!current) return;
    this.table.set(hash, mergeScanState(current, incoming));
  }

  private applyTypes(types: SnapshotTicketType[]) {
    for (const type of types) this.types.set(type.id, type);
  }

  /**
   * Suma a entradas recién agregadas a la tabla los escaneos propios que
   * todavía no subieron (por ejemplo, la tabla nueva después de reabrir la
   * pestaña con pendientes). Las que ya estaban los tienen incluidos.
   */
  private applyPendingTo(hashes: Set<string>) {
    if (hashes.size === 0) return;
    for (const entry of this.pending.values()) {
      if (!hashes.has(entry.hash)) continue;
      const current = this.table.get(entry.hash);
      if (!current) continue;
      this.table.set(entry.hash, {
        ...current,
        scanned: true,
        scannedAt: laterIso(
          current.scannedAt,
          new Date(entry.at).toISOString(),
        ),
        scanCount: current.scanCount + 1,
      });
    }
  }

  /**
   * Vuelve a marcar como escaneadas las entradas de escaneos propios
   * confirmados hace poco: la tabla que acaba de llegar pudo armarse antes.
   * Solo marca (no suma): si la tabla ya los contaba, no se cuentan dos veces.
   */
  private reapplyRecentAcked() {
    const cutoff = this.now() - (SNAPSHOT_TIMEOUT_MS + 15_000);
    for (const [id, acked] of this.recentAcked) {
      if (acked.ackedAt < cutoff) {
        this.recentAcked.delete(id);
        continue;
      }
      const current = this.table.get(acked.hash);
      if (!current) continue;
      this.table.set(acked.hash, {
        ...current,
        scanned: true,
        scannedAt: laterIso(
          current.scannedAt,
          new Date(acked.at).toISOString(),
        ),
        scanCount: Math.max(current.scanCount, 1),
      });
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

      // La tabla se armó en el servidor antes de que terminara de bajar: lo
      // que pasó mientras tanto (escaneos propios ya confirmados, novedades de
      // otros celulares) está en la tabla actual y no se pierde. Las entradas
      // que ya no vienen (borradas) salen.
      const previous = this.table;
      const next = new Map<string, LocalTicket>();
      const fresh = new Set<string>();
      for (const row of snapshot.tickets) {
        const incoming = toLocalTicket(row);
        const known = previous.get(incoming.hash);
        if (known) {
          next.set(incoming.hash, mergeScanState(incoming, known));
        } else {
          next.set(incoming.hash, incoming);
          fresh.add(incoming.hash);
        }
      }
      this.table = next;
      this.applyPendingTo(fresh);
      this.reapplyRecentAcked();
      this.types = new Map();
      this.applyTypes(snapshot.types);
      this.events = new Map(snapshot.events.map((e) => [e.id, e.name]));
      // El cursor puede retroceder: las novedades desde ahí vuelven a traer
      // las entradas creadas mientras bajaba la tabla.
      this.cursor = snapshot.cursor;
      const snapshotServerAt = Date.parse(snapshot.serverNow);
      this.lastPullServerAt = Math.max(
        this.lastPullServerAt ?? snapshotServerAt,
        snapshotServerAt,
      );
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
      if (errorCode(error) === 'PRECONDITION_FAILED') {
        // El modo se apagó en el servidor: no hay tabla. Se vuelve a pedir
        // cuando se prenda (lo trae la consulta de configuración).
        this.serverConfig = { ...this.serverConfig, mode: 'off' };
        this.lastConfigCheckAt = this.now();
        if (this.phase !== 'ready') this.phase = 'idle';
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

  private async runSync() {
    this.syncing = true;
    this.notify();
    try {
      const now = this.now();
      const batch = this.ownPending().slice(0, MAX_SYNC_SCANS);
      const pulling = this.mode !== 'off' && this.phase === 'ready';
      let ok = true;
      if (batch.length > 0 || pulling || this.isConfigCheckDue(now)) {
        ok = await this.syncOwn(batch, pulling);
      }
      // Lo de otros eventos va después y aparte: si falla (por ejemplo, el
      // usuario ya no está asignado a ese evento) no frena esta puerta.
      if (
        ok &&
        !this.stopped &&
        this.foreign.length > 0 &&
        this.now() >= this.foreignRetryAt
      ) {
        await this.flushForeign();
      }
    } finally {
      this.syncing = false;
      this.notify();
    }
  }

  /** Sube lo propio y baja las novedades. false si falló. */
  private async syncOwn(batch: OutboxEntry[], pulling: boolean) {
    this.lastSyncAttemptAt = this.now();
    this.lastConfigCheckAt = this.now();
    const controller = new AbortController();
    this.inflight.add(controller);
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
    const sentAt = this.now();
    try {
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
      if (this.stopped) return false;
      const receivedAt = this.now();
      this.updateOffset(response.serverNow, sentAt, receivedAt);

      const acked: string[] = [];
      for (const result of response.results) {
        const entry = this.pending.get(result.id);
        if (!entry) continue;
        acked.push(result.id);
        this.pending.delete(result.id);
        if (result.outcome === 'registered') {
          this.recentAcked.set(result.id, {
            hash: entry.hash,
            at: entry.at,
            ackedAt: this.now(),
          });
        }
        if (result.outcome === 'registered' && result.hash) {
          this.mergeTicket(result.hash, {
            scanned: true,
            scannedAt: result.scannedAt,
            scanCount: 0,
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
        const added = new Set<string>();
        for (const row of response.delta.added) {
          if (this.table.has(row[0])) {
            this.mergeTicket(row[0], toLocalTicket(row));
          } else {
            this.table.set(row[0], toLocalTicket(row));
            added.add(row[0]);
          }
        }
        this.applyPendingTo(added);
        this.applyTypes(response.delta.types);
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
        pendingAfter: this.pending.size,
      });
      return true;
    } catch (error) {
      if (this.stopped) return false;
      if (controller.signal.reason === NETWORK_CHANGED) {
        // Se cortó a propósito para reintentar por la red nueva.
        this.nextAttemptAt = 0;
        return false;
      }
      this.consecutiveFailures += 1;
      this.lastError = errorCode(error);
      const cap =
        this.pending.size > 0 ? PENDING_MAX_BACKOFF_MS : MAX_BACKOFF_MS;
      this.nextAttemptAt =
        this.now() +
        Math.min(cap, 1_000 * 2 ** Math.min(4, this.consecutiveFailures));
      this.onEvent({
        type: 'sync',
        ok: false,
        latencyMs: this.now() - sentAt,
        pushed: 0,
        pendingAfter: this.pending.size,
        errorCode: this.lastError,
      });
      return false;
    } finally {
      clearTimeout(timeout);
      this.inflight.delete(controller);
    }
  }

  /**
   * Pendientes de otra puerta (otros eventos) del mismo usuario: se suben con
   * sus propios eventos, sin pedir novedades. Si falla, se reintenta con
   * espera creciente (hasta FOREIGN_MAX_BACKOFF_MS), sin borrar nada.
   */
  private async flushForeign() {
    const groups = new Map<string, OutboxEntry[]>();
    for (const entry of this.foreign) {
      const key = [...entry.eventIds].sort().join(',');
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    let failed = false;
    for (const entries of groups.values()) {
      if (this.stopped) return;
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
      } catch {
        // Cortado por un cambio de red: se reintenta enseguida, sin espera.
        if (controller.signal.reason === NETWORK_CHANGED) return;
        failed = true;
      } finally {
        clearTimeout(timeout);
        this.inflight.delete(controller);
      }
    }
    if (failed) {
      this.foreignFailures += 1;
      this.foreignRetryAt =
        this.now() +
        Math.min(
          FOREIGN_MAX_BACKOFF_MS,
          5_000 * 2 ** (this.foreignFailures - 1),
        );
    } else {
      this.foreignFailures = 0;
      this.foreignRetryAt = 0;
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
    // Una sola pestaña decide; solo importa en modo rápido.
    if (this.mode === 'local') {
      if (this.leaderState === 'unknown') return 'claiming';
      if (this.leaderState === 'unsupported') return 'no-locks';
      if (this.leaderState === 'follower') return 'not-leader';
    }
    if (this.needsResync) return 'resync-after-wake';
    if (this.lastPullServerAt === null) return 'never-synced';
    const now = this.correctedNow();
    if (now - this.lastPullServerAt > this.maxStaleMs) return 'stale-pull';
    const oldest = this.oldestPendingAt();
    if (oldest !== null && now - oldest > this.maxStaleMs) return 'stale-push';
    return null;
  }

  private computeStatus(): EngineStatus {
    const staleReason = this.staleReason();
    return {
      mode: this.mode,
      phase: this.phase,
      canDecide: this.mode === 'local' && staleReason === null,
      staleReason,
      pending: this.pending.size,
      foreignPending: this.foreign.length,
      otherUserPending: this.otherUserPending,
      lastSyncAt: this.lastSyncAt,
      tickets: this.table.size,
      leader: this.leaderState === 'leader',
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
