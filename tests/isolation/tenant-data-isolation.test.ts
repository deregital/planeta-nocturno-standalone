import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import test, { after, before } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { loadEnvConfig } from '@next/env';

import { SINGLE_TENANT_ENV_KEYS } from '@/lib/config/single-tenant-config';
import {
  buildTenantDatabaseName,
  createTenantDatabase,
  deleteTenantDatabase,
  getTenantDatabaseUrl,
} from '@/server/neon/get-database-url';
import {
  activateTenantRecord,
  createTenantRecord,
  deleteTenantRecord,
} from '@tests/isolation/control-fixture';
import {
  prepareTenantDatabase,
  type TestAdmin,
} from '@tests/isolation/tenant-fixture';

const port = Number(process.env.ISOLATION_TEST_PORT) || 3399;
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const fixtures: TenantFixture[] = [];
let appProcess: ChildProcess | undefined;
let serverOutput = '';
let tenantA: TenantFixture;
let tenantB: TenantFixture;

loadEnvConfig(process.cwd(), true);

type TenantFixture = {
  id: number;
  slug: string;
  databaseName: string;
  databaseCreated: boolean;
  admin: TestAdmin;
  cookie?: string;
};

type ResponseData = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  json?: unknown;
};

before(
  async () => {
    assertRequiredEnvironment();
    configureMultiTenantEnvironment();

    try {
      tenantA = await createTenantFixture('a');
      tenantB = await createTenantFixture('b');
      appProcess = startApplication();
      await waitForApplication();
      tenantA.cookie = await authenticate(tenantA);
      tenantB.cookie = await authenticate(tenantB);
    } catch (error) {
      throw enrichError(error, 'Falló la preparación del test de aislamiento');
    }
  },
  { timeout: 300_000 },
);

after(
  async () => {
    await stopApplication();

    const cleanupErrors: string[] = [];
    for (const fixture of fixtures.reverse()) {
      let databaseDeleted = !fixture.databaseCreated;

      if (fixture.databaseCreated) {
        try {
          assert.match(fixture.databaseName, /^tenant_\d+_iso_[ab]_/);
          await deleteTenantDatabase(fixture.databaseName);
          databaseDeleted = true;
        } catch (error) {
          cleanupErrors.push(
            `${fixture.slug} (base): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (databaseDeleted) {
        try {
          await deleteTenantRecord(fixture.id);
        } catch (error) {
          cleanupErrors.push(
            `${fixture.slug} (Control DB): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`Falló la limpieza:\n${cleanupErrors.join('\n')}`);
    }
  },
  { timeout: 180_000 },
);

test('una sesión de un tenant no puede leer los usuarios de otro tenant', async () => {
  const usersA = await getUsers(tenantA, tenantA.cookie);
  const usersB = await getUsers(tenantB, tenantB.cookie);

  assert.deepEqual(
    usersA.map((user) => user.fullName),
    [tenantA.admin.fullName],
  );
  assert.deepEqual(
    usersB.map((user) => user.fullName),
    [tenantB.admin.fullName],
  );

  const crossTenantResponse = await request({
    path: '/api/trpc/user.getAll',
    host: tenantHost(tenantB),
    headers: {
      Cookie: requiredCookie(tenantA),
      'x-tenant-id': tenantB.slug,
    },
  });

  assert.equal(crossTenantResponse.statusCode, 401);
  assert.doesNotMatch(
    crossTenantResponse.text,
    new RegExp(tenantB.admin.fullName),
  );

  const crossTenantSession = await request({
    path: '/api/auth/session',
    host: tenantHost(tenantB),
    headers: { Cookie: requiredCookie(tenantA) },
  });
  assert.equal(crossTenantSession.statusCode, 200);
  assert.equal(crossTenantSession.text, 'null');

  const forgedHeaderUsers = await getUsers(tenantA, tenantA.cookie, {
    'x-tenant-id': tenantB.slug,
  });
  assert.deepEqual(
    forgedHeaderUsers.map((user) => user.fullName),
    [tenantA.admin.fullName],
  );
  assert.ok(
    !forgedHeaderUsers.some((user) => user.fullName === tenantB.admin.fullName),
  );
});

async function createTenantFixture(label: 'a' | 'b') {
  const slug = `iso-${label}-${suffix}`.slice(0, 63);
  const record = await createTenantRecord(
    `Aislamiento ${label.toUpperCase()}`,
    slug,
  );
  const fixture: TenantFixture = {
    ...record,
    databaseName: buildTenantDatabaseName(record.id, slug),
    databaseCreated: false,
    admin: {
      username: `admin_${label}_${suffix}`,
      password: `Isolation-${label.toUpperCase()}-123!`,
      email: `admin-${label}-${suffix}@example.com`,
      fullName: `SOLO TENANT ${label.toUpperCase()} ${suffix}`,
    },
  };
  fixtures.push(fixture);

  await createTenantDatabase(fixture.databaseName);
  fixture.databaseCreated = true;
  const connectionString = await getTenantDatabaseUrl(fixture.databaseName);
  await prepareTenantDatabase(connectionString, fixture.admin);
  await activateTenantRecord(fixture.id, fixture.databaseName);

  return fixture;
}

function configureMultiTenantEnvironment() {
  for (const key of SINGLE_TENANT_ENV_KEYS) process.env[key] = '';
  process.env.ROOT_DOMAIN = 'localhost';
  process.env.AUTH_SECRET =
    'tenant-isolation-test-secret-with-at-least-32-characters';
  process.env.AUTH_TRUST_HOST = 'true';
}

function assertRequiredEnvironment() {
  for (const key of [
    'CONTROL_DATABASE_URL',
    'NEON_API_KEY',
    'NEON_PROJECT_NAME',
  ]) {
    assert.ok(
      process.env[key]?.trim(),
      `${key} es requerida para test:isolation`,
    );
  }
}

function startApplication() {
  const nextBin = path.resolve('node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(
    process.execPath,
    [nextBin, 'dev', '--turbopack', '-p', String(port)],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  const appendOutput = (chunk: Buffer) => {
    serverOutput = `${serverOutput}${chunk.toString()}`.slice(-20_000);
  };
  child.stdout?.on('data', appendOutput);
  child.stderr?.on('data', appendOutput);
  return child;
}

async function waitForApplication() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (appProcess?.exitCode !== null) {
      throw new Error(`Next terminó antes de iniciar.\n${serverOutput}`);
    }

    try {
      const response = await request({ path: '/', host: `localhost:${port}` });
      if (response.statusCode > 0) return;
    } catch {
      // El socket todavía no está disponible.
    }

    await delay(500);
  }

  throw new Error(`Next no respondió dentro de 120 segundos.\n${serverOutput}`);
}

async function stopApplication() {
  if (!appProcess || appProcess.exitCode !== null) return;

  appProcess.kill();
  await Promise.race([
    new Promise((resolve) => appProcess?.once('exit', resolve)),
    delay(5_000),
  ]);
  if (appProcess.exitCode === null) appProcess.kill('SIGKILL');
}

async function authenticate(tenant: TenantFixture) {
  const host = tenantHost(tenant);
  const csrfResponse = await request({ path: '/api/auth/csrf', host });
  assert.equal(csrfResponse.statusCode, 200, csrfResponse.text);
  const csrf = csrfResponse.json as { csrfToken?: string } | undefined;
  assert.ok(csrf?.csrfToken, 'Auth.js no devolvió un CSRF token');
  let cookie = mergeCookies('', csrfResponse.headers['set-cookie']);

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    name: tenant.admin.username,
    password: tenant.admin.password,
    callbackUrl: `http://${host}/admin`,
  }).toString();
  const loginResponse = await request({
    path: '/api/auth/callback/credentials',
    host,
    method: 'POST',
    rawBody: body,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
  });
  assert.equal(loginResponse.statusCode, 200, loginResponse.text);
  assert.doesNotMatch(loginResponse.text, /error=CredentialsSignin/i);
  cookie = mergeCookies(cookie, loginResponse.headers['set-cookie']);

  const sessionResponse = await request({
    path: '/api/auth/session',
    host,
    headers: { Cookie: cookie },
  });
  assert.equal(sessionResponse.statusCode, 200, sessionResponse.text);
  const session = sessionResponse.json as
    | { user?: { tenantSlug?: string } }
    | undefined;
  assert.equal(session?.user?.tenantSlug, tenant.slug);

  return cookie;
}

async function getUsers(
  tenant: TenantFixture,
  cookie?: string,
  headers: Record<string, string> = {},
) {
  const response = await request({
    path: '/api/trpc/user.getAll',
    host: tenantHost(tenant),
    headers: { Cookie: cookie ?? '', ...headers },
  });
  assert.equal(response.statusCode, 200, response.text);

  const payload = response.json as
    | { result?: { data?: { json?: unknown } | unknown } }
    | undefined;
  const data = payload?.result?.data;
  const users =
    data && typeof data === 'object' && 'json' in data
      ? (data.json as unknown)
      : data;
  assert.ok(
    Array.isArray(users),
    `Respuesta tRPC inesperada: ${response.text}`,
  );
  return users as { fullName: string }[];
}

function tenantHost(tenant: TenantFixture) {
  return `${tenant.slug}.localhost:${port}`;
}

function requiredCookie(tenant: TenantFixture) {
  assert.ok(tenant.cookie, `No hay cookie para ${tenant.slug}`);
  return tenant.cookie;
}

function request({
  path: requestPath,
  host,
  method = 'GET',
  rawBody,
  headers = {},
}: {
  path: string;
  host: string;
  method?: string;
  rawBody?: string;
  headers?: Record<string, string>;
}): Promise<ResponseData> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: {
          Host: host,
          Accept: 'application/json',
          ...(rawBody === undefined
            ? {}
            : {
                'Content-Type': headers['Content-Type'] ?? 'application/json',
                'Content-Length': Buffer.byteLength(rawBody),
              }),
          ...headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown;
          try {
            json = text ? JSON.parse(text) : undefined;
          } catch {
            json = undefined;
          }
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            text,
            json,
          });
        });
      },
    );
    request.setTimeout(120_000, () => {
      request.destroy(new Error('La petición excedió 120 segundos'));
    });
    request.on('error', reject);
    if (rawBody !== undefined) request.write(rawBody);
    request.end();
  });
}

function mergeCookies(
  currentCookie: string,
  setCookieHeaders: string | string[] | undefined,
) {
  const cookies = new Map<string, string>();
  for (const pair of currentCookie.split('; ').filter(Boolean)) {
    const separator = pair.indexOf('=');
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
      ? [setCookieHeaders]
      : [];
  for (const header of headers) {
    const pair = header.split(';', 1)[0];
    const separator = pair.indexOf('=');
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}

function enrichError(error: unknown, context: string) {
  const cause = error instanceof Error ? error.message : String(error);
  return new Error(
    `${context}: ${cause}\n\nÚltima salida del servidor:\n${serverOutput}`,
  );
}
