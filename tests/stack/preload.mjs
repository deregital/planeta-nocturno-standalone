// Se carga en el proceso de Next (`NODE_OPTIONS=--import`) para que ningún
// servicio externo real reciba tráfico del entorno de prueba:
// - API de Neon: responde con las bases del Postgres local (crea, renombra y
//   borra bases de verdad, así el panel de control puede crear plataformas).
// - Mercado Pago (node-fetch → https.request) y S3 (AWS SDK → https.request):
//   se desvían al servidor de mocks (mocks.mjs), que conserva el Host original.
// - fetch a S3 (optimizador de next/image) también va al mock.
import http from 'node:http';
import https from 'node:https';

import pg from 'pg';

const MOCKS = new URL(process.env.STACK_MOCKS_URL ?? 'http://127.0.0.1:55801');
const NEON = 'https://console.neon.tech/api/v2';
const PG_BASE = process.env.PG_BASE;
const MOCKED_HOSTS = [/^api\.mercadopago\.com$/, /\.amazonaws\.com$/];

const isMockedHost = (host) => MOCKED_HOSTS.some((re) => re.test(host ?? ''));

// Hora y nivel en cada error/aviso del servidor: check.mjs los filtra por fecha.
for (const level of ['error', 'warn']) {
  const original = console[level].bind(console);
  console[level] = (...args) => original(`[${level.toUpperCase()} ${new Date().toISOString()}]`, ...args);
}

// ── https.request / https.get ────────────────────────────────────────────────
function redirectToMocks(original) {
  return function patched(...args) {
    let [url, options, callback] = args;
    if (typeof url === 'string' || url instanceof URL) {
      const parsed = new URL(url);
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      options = {
        ...options,
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
      };
    } else {
      callback = options;
      options = url;
    }
    const host = options.hostname ?? options.host?.split(':')[0];
    if (!isMockedHost(host)) return original(...args);

    const headers = { ...(options.headers ?? {}) };
    const hasHost = Object.keys(headers).some((key) => key.toLowerCase() === 'host');
    if (!hasHost) headers.host = host;
    return http.request(
      {
        method: options.method ?? 'GET',
        hostname: MOCKS.hostname,
        port: MOCKS.port,
        path: options.path ?? '/',
        headers: { ...headers, 'x-stack-original-host': host },
        timeout: options.timeout,
        signal: options.signal,
      },
      callback,
    );
  };
}

https.request = redirectToMocks(https.request.bind(https));
https.get = (...args) => {
  const req = https.request(...args);
  req.end();
  return req;
};

// ── Neon API ─────────────────────────────────────────────────────────────────
let adminPool;
function admin() {
  adminPool ??= new pg.Pool({ connectionString: `${PG_BASE}/postgres`, max: 2 });
  return adminPool;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const ident = (name) => `"${String(name).replaceAll('"', '""')}"`;

async function databaseExists(name) {
  const { rowCount } = await admin().query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  return rowCount > 0;
}

async function neon(method, path, searchParams, body) {
  if (path === '/projects') {
    return json({ projects: [{ id: 'local', name: process.env.NEON_PROJECT_NAME }] });
  }
  if (path === '/projects/local/branches') {
    return json({ branches: [{ id: 'br-local', parent_id: null }] });
  }
  if (path === '/projects/local/connection_uri') {
    return json({ uri: `${PG_BASE}/${searchParams.get('database_name')}` });
  }
  if (path.startsWith('/projects/local/operations/')) {
    return json({ operation: { id: path.split('/').pop(), status: 'finished' } });
  }
  const databases = '/projects/local/branches/br-local/databases';
  if (path === databases && method === 'POST') {
    const name = body?.database?.name;
    if (await databaseExists(name)) return json({ message: 'database already exists' }, 409);
    await admin().query(`CREATE DATABASE ${ident(name)}`);
    return json({ database: { name }, operations: [] }, 201);
  }
  if (path.startsWith(`${databases}/`)) {
    const name = decodeURIComponent(path.slice(databases.length + 1));
    if (!(await databaseExists(name))) return json({ message: 'not found' }, 404);
    if (method === 'GET') return json({ database: { name } });
    if (method === 'DELETE') {
      await admin().query(`DROP DATABASE ${ident(name)} WITH (FORCE)`);
      return json({ database: { name }, operations: [] });
    }
    if (method === 'PATCH') {
      const newName = body?.database?.name;
      await admin().query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [name],
      );
      await admin().query(`ALTER DATABASE ${ident(name)} RENAME TO ${ident(newName)}`);
      return json({ database: { name: newName }, operations: [] });
    }
  }
  return json({ message: `neon mock: ${method} ${path} no soportado` }, 404);
}

// ── fetch ────────────────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
globalThis.fetch = async function stackFetch(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(NEON)) {
    const { pathname, searchParams } = new URL(url);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let body;
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
    try {
      return await neon(method, pathname.replace('/api/v2', ''), searchParams, body);
    } catch (error) {
      return json({ message: `neon mock: ${error.message}` }, 500);
    }
  }
  const parsed = URL.canParse(url) ? new URL(url) : null;
  if (parsed && isMockedHost(parsed.hostname)) {
    const target = new URL(parsed.pathname + parsed.search, MOCKS);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('x-stack-original-host', parsed.hostname);
    return realFetch(target, { ...init, headers });
  }
  return realFetch(input, init);
};
