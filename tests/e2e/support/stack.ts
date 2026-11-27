// Acceso al stack simulado desde los tests: variables, datos sembrados, bases,
// bandeja de mails y el chequeo final.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Client, Pool } from 'pg';
import { RUN } from '@tests/stack/browser-env.mjs';

export { RUN };

export type TenantKey = 'prueba' | 'otra';
export type SeedUser = {
  username: string;
  role: string;
  fullName: string;
  email: string;
};
export type SeedEvent = {
  key: string;
  id: string;
  slug: string;
  name: string;
  ticketTypes?: {
    id: string;
    name: string;
    price: number;
    maxAvailable: number;
  }[];
};
export type SeedQr = {
  file: string;
  fullName: string;
  emittedTicketId: string;
};
type Seed = {
  createdAt: string;
  password: string;
  tenants: Record<
    TenantKey,
    {
      url: string;
      users: SeedUser[];
      events: SeedEvent[];
      invitationCodes?: { code: string; organizer: string }[];
      qr: Record<string, SeedQr[]>;
    }
  >;
  junkQr: string;
};

// Lee .run/env.sh (lo genera up.sh) sin pisar lo que ya venga del entorno.
export function loadStackEnv() {
  const file = path.join(RUN, 'env.sh');
  if (!existsSync(file)) {
    throw new Error(
      'No hay stack simulado: correr tests/stack/up.sh antes de los tests',
    );
  }
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^export ([A-Z0-9_]+)=(.*)$/);
    if (!match || match[2].includes('${')) continue;
    process.env[match[1]] ??= match[2].replace(/^"(.*)"$/, '$1');
  }
}

let cachedSeed: Seed | undefined;
export function seed(): Seed {
  cachedSeed ??= JSON.parse(
    readFileSync(path.join(RUN, 'seed.json'), 'utf8'),
  ) as Seed;
  return cachedSeed;
}

export const tenantUrl = (tenant: TenantKey = 'prueba') =>
  seed().tenants[tenant].url;

export function seedEvent(
  key: string,
  tenant: TenantKey = 'prueba',
): SeedEvent {
  const found = seed().tenants[tenant].events.find(
    (event) => event.key === key,
  );
  if (!found)
    throw new Error(`No está el evento sembrado "${key}" en ${tenant}`);
  return found;
}

export function seedUser(
  username: string,
  tenant: TenantKey = 'prueba',
): SeedUser {
  const found = seed().tenants[tenant].users.find(
    (user) => user.username === username,
  );
  if (!found)
    throw new Error(`No está el usuario sembrado "${username}" en ${tenant}`);
  return found;
}

// Datos de una persona nueva por test, para que corran en paralelo y se puedan
// repetir sin volver a sembrar.
let personSeq = 0;
export function newPerson(label: string) {
  personSeq += 1;
  const stamp = `${Date.now().toString().slice(-7)}${process.env.TEST_PARALLEL_INDEX ?? 0}${personSeq}`;
  return {
    fullName: `${label} Golden ${stamp}`,
    email: `${label.toLowerCase()}-${stamp}@golden.pn.test`,
    dni: `5${stamp.slice(-7)}`,
    phone: `11${stamp.slice(-8)}`,
    birth: { day: '14', month: '03', year: '1995' },
  };
}
export type Person = ReturnType<typeof newPerson>;

// ── Bases ────────────────────────────────────────────────────────────────────
const pools = new Map<TenantKey, Pool>();
export async function tenantDb(tenant: TenantKey = 'prueba'): Promise<Pool> {
  const existing = pools.get(tenant);
  if (existing) return existing;
  const control = new Client({
    connectionString: process.env.CONTROL_DATABASE_URL,
  });
  await control.connect();
  const { rows } = await control.query<{ database_name: string }>(
    'SELECT database_name FROM tenants WHERE slug = $1',
    [tenant],
  );
  await control.end();
  if (!rows[0])
    throw new Error(`No existe la plataforma ${tenant} en el control`);
  const pool = new Pool({
    connectionString: `${process.env.PG_BASE}/${rows[0].database_name}`,
    max: 3,
  });
  pools.set(tenant, pool);
  return pool;
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  tenant: TenantKey = 'prueba',
): Promise<T[]> {
  const db = await tenantDb(tenant);
  return (await db.query<T>(sql, params)).rows;
}

// ── Mails (bandeja de mocks.mjs) ─────────────────────────────────────────────
export type Mail = {
  id: string;
  receivedAt: string;
  to: string;
  subject: string;
  attachments: string[];
};

export async function mailsTo(address: string): Promise<Mail[]> {
  const response = await fetch(
    `${process.env.STACK_MOCKS_URL}/api/mails?to=${encodeURIComponent(address)}`,
    { headers: { 'x-stack-original-host': 'mail.mock.test' } },
  );
  if (!response.ok) throw new Error(`bandeja de mails: ${response.status}`);
  return (await response.json()) as Mail[];
}

export async function mailAttachment(
  mailId: string,
  index: number,
): Promise<Buffer> {
  const response = await fetch(
    `${process.env.STACK_MOCKS_URL}/m/${mailId}/a/${index}`,
    {
      headers: { 'x-stack-original-host': 'mail.mock.test' },
    },
  );
  if (!response.ok)
    throw new Error(`adjunto ${index} del mail ${mailId}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export const startFile = path.join(RUN, 'e2e-start');
export const baselineFile = path.join(RUN, 'e2e-baseline.json');
