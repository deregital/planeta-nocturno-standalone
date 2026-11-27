/**
 * Lo que comparten las pruebas de los pedidos firmados de Pluto: el Postgres
 * de prueba, la firma como la hace Pluto y una API de Neon simulada que
 * resuelve cada base de productora en ese mismo Postgres.
 */
import { createHmac } from 'node:crypto';

export const ADMIN_URL =
  process.env.LOAD_ADMIN_DATABASE_URL ??
  'postgres://postgres:pg@localhost:5432/postgres';
export const SIGNING_SECRET = 'pluto-api-test-secret';

export function databaseUrl(name: string) {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

/** El pedido como lo arma `signedFetch` en Pluto. */
export function signedRequest(
  url: string,
  body: unknown,
  { secret = SIGNING_SECRET }: { secret?: string } = {},
) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: new URL(url).host,
      'x-forwarded-proto': 'https',
      'x-timestamp': timestamp,
      'x-signature': `sha256=${signature}`,
    },
    body: rawBody,
  });
}

const NEON = 'https://console.neon.tech/api/v2';

/** Sólo lo que usa `getTenantDatabaseUrl`: proyecto, rama y URI de la base. */
export function mockNeonApi() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.startsWith(NEON)) return realFetch(input, init);

    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace('/api/v2', '');
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    if (path === '/projects') {
      return json({
        projects: [{ id: 'local', name: process.env.NEON_PROJECT_NAME }],
      });
    }
    if (path === '/projects/local/branches') {
      return json({ branches: [{ id: 'br-local', parent_id: null }] });
    }
    if (path === '/projects/local/connection_uri') {
      return json({ uri: databaseUrl(searchParams.get('database_name')!) });
    }
    return new Response('neon mock: no soportado', { status: 404 });
  };
}
