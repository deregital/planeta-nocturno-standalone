import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

async function importTypeScript(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  return import(moduleUrl);
}

const { createSingleTenantConfig, SINGLE_TENANT_ENV_KEYS } =
  await importTypeScript('../src/lib/config/single-tenant-config.ts');
const {
  getRequestHost,
  getSubdomain,
  normalizeRootDomain,
  resolveMultiTenantHost,
} = await importTypeScript('../src/lib/tenancy/host.ts');

for (const key of SINGLE_TENANT_ENV_KEYS) {
  test(`reconoce ${key} como configuración single-tenant`, () => {
    assert.throws(
      () => createSingleTenantConfig({ [key]: 'configured' }),
      /DATABASE_URL|NEXT_PUBLIC_INSTANCE_NAME|INSTANCE_WEB_URL/,
    );
  });
}

test('devuelve null cuando no hay configuración single-tenant', () => {
  assert.equal(createSingleTenantConfig({}), null);
});

test('crea y normaliza la configuración single-tenant', () => {
  assert.deepEqual(
    createSingleTenantConfig({
      DATABASE_URL: ' postgresql://example/database ',
      INSTANCE_CONTACT_EMAIL: ' contacto@example.com ',
      INSTANCE_WEB_URL: 'cliente.example.com',
      MP_ACCESS_TOKEN: ' access-token ',
      MP_REFRESH_TOKEN: ' refresh-token ',
      MP_SECRET_KEY: ' secret-key ',
      NEXT_PUBLIC_FAVICON_URL: 'https://cliente.example.com/favicon.ico',
      NEXT_PUBLIC_HUE: '210',
      NEXT_PUBLIC_INSTANCE_DESCRIPTION: ' Descripción ',
      NEXT_PUBLIC_INSTANCE_NAME: ' Cliente ',
      NEXT_PUBLIC_SATURATION: '80',
      NEXT_PUBLIC_SITE_URL: 'https://tickets.cliente.example.com',
    }),
    {
      databaseUrl: 'postgresql://example/database',
      name: 'Cliente',
      publicUrl: 'https://cliente.example.com',
      siteUrl: 'https://tickets.cliente.example.com',
      contactEmail: 'contacto@example.com',
      description: 'Descripción',
      faviconUrl: 'https://cliente.example.com/favicon.ico',
      hue: 210,
      saturation: 80,
      mercadoPagoAccessToken: 'access-token',
      mercadoPagoRefreshToken: 'refresh-token',
      mercadoPagoSecretKey: 'secret-key',
    },
  );
});

test('trata todas las variables vacías como configuración multi-tenant', () => {
  const environment = Object.fromEntries(
    SINGLE_TENANT_ENV_KEYS.map((key, index) => [
      key,
      index % 2 === 0 ? '' : '   ',
    ]),
  );

  assert.equal(createSingleTenantConfig(environment), null);
});

test('resuelve un único nivel de subdominio', () => {
  assert.equal(
    getSubdomain('cliente.planeta.test:3000', 'planeta.test'),
    'cliente',
  );
  assert.equal(getSubdomain('otro.cliente.planeta.test', 'planeta.test'), null);
  assert.equal(getSubdomain('planeta.test', 'planeta.test'), null);
});

test('normaliza y valida el dominio raíz', () => {
  assert.equal(normalizeRootDomain('.PLANETA.TEST'), 'planeta.test');
  assert.throws(
    () => normalizeRootDomain('https://planeta.test'),
    /ROOT_DOMAIN/,
  );
});

test('clasifica el dominio de administración', () => {
  assert.deepEqual(
    resolveMultiTenantHost('admin.planeta.test', 'planeta.test'),
    { type: 'admin' },
  );
});

test('clasifica el dominio de un tenant', () => {
  assert.deepEqual(
    resolveMultiTenantHost('cliente.planeta.test', 'planeta.test'),
    { type: 'tenant', slug: 'cliente' },
  );
});

test('distingue el dominio raíz y los dominios desconocidos', () => {
  assert.deepEqual(resolveMultiTenantHost('planeta.test', 'planeta.test'), {
    type: 'root',
  });
  assert.deepEqual(resolveMultiTenantHost('otro.example.com', 'planeta.test'), {
    type: 'unknown',
  });
  assert.deepEqual(resolveMultiTenantHost('www.planeta.test', 'planeta.test'), {
    type: 'unknown',
  });
});

test('prioriza x-forwarded-host para resolver el dominio público', () => {
  assert.equal(
    getRequestHost(
      new Headers({
        host: 'localhost:3000',
        'x-forwarded-host': 'cliente.planeta.test, proxy.internal',
      }),
    ),
    'cliente.planeta.test',
  );
});
