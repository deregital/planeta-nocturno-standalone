/**
 * Escaneos decididos en el celular que todavía no confirmó el servidor. Se
 * guardan en IndexedDB ANTES de mostrar el verde: si la pestaña se cierra, se
 * suben al volver a abrir el escáner.
 */
export type OutboxEntry = {
  /** clientScanId: el servidor lo usa para no registrar dos veces. */
  id: string;
  /** Lo que leyó la cámara; el servidor lo vuelve a descifrar. */
  code: string;
  /** Hora del escaneo con el reloj corregido contra el servidor (ms). */
  at: number;
  userId: string;
  eventIds: string[];
  hash: string;
  createdAt: number;
};

export interface OutboxStore {
  list(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

const DB_NAME = 'pn-scanner';
const STORE = 'outbox';

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB abort'));
  });
}

export class IndexedDbOutboxStore implements OutboxStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open() {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no disponible'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB bloqueada'));
    }).catch((error) => {
      this.dbPromise = null;
      throw error;
    });
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode) {
    const db = await this.open();
    // `strict`: el escaneo queda en disco antes de que se muestre el verde.
    return db.transaction(STORE, mode, { durability: 'strict' });
  }

  async list() {
    const tx = await this.tx('readonly');
    return requestToPromise(tx.objectStore(STORE).getAll()) as Promise<
      OutboxEntry[]
    >;
  }

  async put(entry: OutboxEntry) {
    const tx = await this.tx('readwrite');
    tx.objectStore(STORE).put(entry);
    await transactionDone(tx);
  }

  async remove(ids: string[]) {
    if (ids.length === 0) return;
    const tx = await this.tx('readwrite');
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    await transactionDone(tx);
  }
}

/** Para pruebas y para cuando no hay IndexedDB (no persiste). */
export class MemoryOutboxStore implements OutboxStore {
  entries = new Map<string, OutboxEntry>();
  failPuts = false;

  async list() {
    return [...this.entries.values()];
  }

  async put(entry: OutboxEntry) {
    if (this.failPuts) throw new Error('almacenamiento lleno');
    this.entries.set(entry.id, entry);
  }

  async remove(ids: string[]) {
    for (const id of ids) this.entries.delete(id);
  }
}
