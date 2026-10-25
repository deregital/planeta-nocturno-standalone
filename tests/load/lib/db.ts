import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import { Client, Pool } from 'pg';

import { createDb, type Db } from '@/drizzle';

import { migrateTenantDatabase } from '@/server/tenancy/migrate-tenant-database';

const ADMIN_URL =
  process.env.LOAD_ADMIN_DATABASE_URL ??
  'postgres://postgres:pg@localhost:5432/postgres';

/** Un template por versión de las migraciones: cambiar de rama no reusa uno viejo. */
async function templateName() {
  const migrations = await readdir(
    path.join(process.cwd(), 'prisma', 'migrations'),
  );
  const hash = createHash('sha256')
    .update(migrations.sort().join('\n'))
    .digest('hex')
    .slice(0, 10);
  return `pn_load_template_${hash}`;
}

function urlForDatabase(name: string, port?: number) {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  if (port) {
    url.hostname = '127.0.0.1';
    url.port = String(port);
  }
  return url.toString();
}

async function adminQuery(sql: string) {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

async function ensureTemplate() {
  const template = await templateName();
  const { rowCount } = await adminQuery(
    `SELECT 1 FROM pg_database WHERE datname = '${template}'`,
  );
  if (rowCount) return template;
  await adminQuery(`CREATE DATABASE ${template}`);
  await migrateTenantDatabase(urlForDatabase(template));
  return template;
}

/** Crea una base vacía (ya migrada) para un escenario. */
export async function createScenarioDatabase(name: string) {
  const template = await ensureTemplate();
  const dbName = `pn_load_${name.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  await adminQuery(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminQuery(`CREATE DATABASE ${dbName} TEMPLATE ${template}`);
  return dbName;
}

/**
 * Proxy TCP que demora cada chunk `oneWayMs` en cada dirección.
 * Un round trip a la base cuesta ~2 × oneWayMs (simula app ↔ Neon en otra región).
 */
export async function startLatencyProxy(oneWayMs: number) {
  const target = new URL(ADMIN_URL);
  const sockets = new Set<net.Socket>();

  const pipeWithDelay = (from: net.Socket, to: net.Socket) => {
    from.on('data', (chunk) => {
      setTimeout(() => {
        if (!to.destroyed) to.write(chunk);
      }, oneWayMs);
    });
    from.on('end', () => setTimeout(() => to.end(), oneWayMs));
    from.on('error', () => to.destroy());
  };

  const server = net.createServer((clientSocket) => {
    const upstream = net.connect(Number(target.port || 5432), target.hostname);
    clientSocket.setNoDelay(true);
    upstream.setNoDelay(true);
    sockets.add(clientSocket).add(upstream);
    pipeWithDelay(clientSocket, upstream);
    pipeWithDelay(upstream, clientSocket);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;

  return {
    port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

let queryCount = 0;
const originalClientQuery = Client.prototype.query;
// Cuenta cada round trip que drizzle/pg mandan a la base (incluye BEGIN/COMMIT).
Client.prototype.query = function countedQuery(
  this: Client,
  ...args: Parameters<Client['query']>
) {
  queryCount += 1;
  return (originalClientQuery as (...a: unknown[]) => unknown).apply(
    this,
    args,
  );
} as Client['query'];

export function resetQueryCount() {
  queryCount = 0;
}

export function getQueryCount() {
  return queryCount;
}

export type LoadDb = {
  db: Db;
  /** Pool directo, sin proxy de latencia: para seeds y verificaciones. */
  raw: Pool;
  close: () => Promise<void>;
};

export async function openLoadDb(
  dbName: string,
  { rttMs = 0, poolMax = 10 }: { rttMs?: number; poolMax?: number } = {},
): Promise<LoadDb> {
  const proxy = rttMs > 0 ? await startLatencyProxy(rttMs / 2) : null;
  const db = createDb(urlForDatabase(dbName, proxy?.port), {
    max: poolMax,
    connectionTimeoutMillis: 120_000,
  });
  const raw = new Pool({ connectionString: urlForDatabase(dbName), max: 4 });

  return {
    db,
    raw,
    close: async () => {
      await db.$client.end();
      await raw.end();
      await proxy?.close();
    },
  };
}
