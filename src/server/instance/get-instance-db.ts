import 'server-only';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { createDb, type Db } from '@/drizzle';

import { getTenantDatabaseUrl } from '@/server/neon/get-database-url';

const TENANT_CACHE_TTL_MS = 15 * 60 * 1000;
const TENANT_CACHE_TARGET_SIZE = 50;
const TENANT_POOL_OPTIONS = {
  max: 3,
  min: 0,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;

type CachedTenantDb = {
  connection: Promise<Db>;
  db?: Db;
  lastUsedAt: number;
};

let singleTenantConnection: Promise<Db> | undefined;
const tenantConnections = new Map<string, CachedTenantDb>();

export function getInstanceDb(database: ResolvedInstance['database']) {
  if ('url' in database) {
    singleTenantConnection ??= Promise.resolve(createDb(database.url));
    return singleTenantConnection;
  }

  const now = Date.now();
  removeExpiredTenantConnections(now);

  const existingConnection = tenantConnections.get(database.name);

  if (existingConnection) {
    existingConnection.lastUsedAt = now;
    return existingConnection.connection;
  }

  trimTenantConnections();

  const cachedTenantDb: CachedTenantDb = {
    connection: createTenantDb(database.name),
    lastUsedAt: now,
  };

  cachedTenantDb.connection = cachedTenantDb.connection
    .then((db) => {
      cachedTenantDb.db = db;
      return db;
    })
    .catch((error) => {
      if (tenantConnections.get(database.name) === cachedTenantDb) {
        tenantConnections.delete(database.name);
      }
      throw error;
    });

  tenantConnections.set(database.name, cachedTenantDb);
  return cachedTenantDb.connection;
}

export async function closeTenantDb(databaseName: string) {
  const cachedTenantDb = tenantConnections.get(databaseName);
  if (!cachedTenantDb) return;

  tenantConnections.delete(databaseName);

  const db = await cachedTenantDb.connection.catch(() => null);
  if (db) await db.$client.end();
}

async function createTenantDb(databaseName: string) {
  const databaseUrl = await getTenantDatabaseUrl(databaseName);
  return createDb(databaseUrl, TENANT_POOL_OPTIONS);
}

function removeExpiredTenantConnections(now: number) {
  for (const [databaseName, cachedTenantDb] of tenantConnections) {
    if (now - cachedTenantDb.lastUsedAt >= TENANT_CACHE_TTL_MS) {
      closeIdleTenantDb(databaseName, cachedTenantDb);
    }
  }
}

function trimTenantConnections() {
  if (tenantConnections.size < TENANT_CACHE_TARGET_SIZE) return;

  const oldestConnections = [...tenantConnections.entries()].sort(
    ([, first], [, second]) => first.lastUsedAt - second.lastUsedAt,
  );

  for (const [databaseName, cachedTenantDb] of oldestConnections) {
    if (tenantConnections.size < TENANT_CACHE_TARGET_SIZE) return;
    closeIdleTenantDb(databaseName, cachedTenantDb);
  }
}

function closeIdleTenantDb(
  databaseName: string,
  cachedTenantDb: CachedTenantDb,
) {
  const pool = cachedTenantDb.db?.$client;
  if (!pool || pool.totalCount !== pool.idleCount) return;

  tenantConnections.delete(databaseName);
  void pool.end().catch((error) => {
    console.error('Unable to close cached tenant database', {
      databaseName,
      error,
    });
  });
}
