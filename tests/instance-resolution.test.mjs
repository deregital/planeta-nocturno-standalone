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

const {
  createSingleTenantConfig,
  SINGLE_TENANT_ENV_KEYS,
} = await importTypeScript('../src/lib/config/single-tenant-config.ts');
const { getSubdomain, normalizeRootDomain } = await importTypeScript(
  '../src/lib/tenancy/host.ts',
);

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
      NEXT_PUBLIC_HUE: '210',
      NEXT_PUBLIC_INSTANCE_DESCRIPTION: ' Descripción ',
      NEXT_PUBLIC_INSTANCE_NAME: ' Cliente ',
      NEXT_PUBLIC_SATURATION: '80',
    }),
    {
      databaseUrl: 'postgresql://example/database',
      name: 'Cliente',
      publicUrl: 'https://cliente.example.com',
      contactEmail: 'contacto@example.com',
      description: 'Descripción',
      faviconUrl: undefined,
      hue: 210,
      saturation: 80,
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
  assert.equal(getSubdomain('cliente.planeta.test:3000', 'planeta.test'), 'cliente');
  assert.equal(getSubdomain('otro.cliente.planeta.test', 'planeta.test'), null);
  assert.equal(getSubdomain('planeta.test', 'planeta.test'), null);
});

test('normaliza y valida el dominio raíz', () => {
  assert.equal(normalizeRootDomain('.PLANETA.TEST'), 'planeta.test');
  assert.throws(() => normalizeRootDomain('https://planeta.test'), /ROOT_DOMAIN/);
});

