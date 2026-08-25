import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import ts from 'typescript';

async function compileTypeScript(relativePath, replacements = {}) {
  const sourceUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(sourceUrl, 'utf8');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  });

  for (const [specifier, replacement] of Object.entries(replacements)) {
    outputText = outputText.replaceAll(`'${specifier}'`, `'${replacement}'`);
  }

  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const singleTenantConfigUrl = await compileTypeScript(
  '../src/lib/config/single-tenant-config.ts',
);
const hostUrl = await compileTypeScript('../src/lib/tenancy/host.ts');
const environmentUrl = await compileTypeScript(
  '../src/lib/config/environment.ts',
  {
    './single-tenant-config': singleTenantConfigUrl,
    '../tenancy/host': hostUrl,
  },
);

const {
  MULTI_TENANT_REQUIRED_ENV_KEYS,
  SHARED_REQUIRED_ENV_KEYS,
  validateEnvironment,
} = await import(environmentUrl);
const { SINGLE_TENANT_ENV_KEYS } = await import(singleTenantConfigUrl);

const sharedEnvironment = Object.fromEntries(
  SHARED_REQUIRED_ENV_KEYS.map((key) => [key, `${key}-value`]),
);

Object.assign(sharedEnvironment, {
  GUIDE_URL: 'https://guide.example.com',
  NEXT_PUBLIC_S3_BUCKET_URL: 'https://bucket.example.com',
  PLUTO_URL: 'https://pluto.example.com',
});

const singleTenantEnvironment = {
  ...sharedEnvironment,
  ...Object.fromEntries(
    SINGLE_TENANT_ENV_KEYS.map((key) => [key, `${key}-value`]),
  ),
  DATABASE_URL: 'postgresql://user:password@database.example.com/tenant',
  INSTANCE_CONTACT_EMAIL: 'contact@example.com',
  INSTANCE_WEB_URL: 'https://tenant.example.com',
  NEXT_PUBLIC_FAVICON_URL: 'https://tenant.example.com/favicon.ico',
  NEXT_PUBLIC_HUE: '210',
  NEXT_PUBLIC_SATURATION: '80',
  NEXT_PUBLIC_SITE_URL: 'https://tenant.example.com',
};

const multiTenantEnvironment = {
  ...sharedEnvironment,
  ...Object.fromEntries(
    MULTI_TENANT_REQUIRED_ENV_KEYS.map((key) => [key, `${key}-value`]),
  ),
  CONTROL_DATABASE_URL:
    'postgresql://user:password@database.example.com/control',
  MULTI_TENANT_LANDING_COLOR: '#7c3aed',
  ROOT_DOMAIN: 'example.com',
};

test('valida una instancia single-tenant completa', () => {
  assert.equal(validateEnvironment(singleTenantEnvironment), 'single-tenant');
});

test('valida una instancia multi-tenant completa', () => {
  assert.equal(validateEnvironment(multiTenantEnvironment), 'multi-tenant');
});

test('requiere cada variable compartida', () => {
  for (const key of SHARED_REQUIRED_ENV_KEYS) {
    assert.throws(
      () => validateEnvironment({ ...multiTenantEnvironment, [key]: '' }),
      new RegExp(`${key} is required`),
    );
  }
});

test('requiere cada variable single-tenant', () => {
  for (const key of SINGLE_TENANT_ENV_KEYS) {
    assert.throws(
      () => validateEnvironment({ ...singleTenantEnvironment, [key]: '' }),
      new RegExp(`${key} is required`),
    );
  }
});

test('requiere cada variable multi-tenant', () => {
  for (const key of MULTI_TENANT_REQUIRED_ENV_KEYS) {
    assert.throws(
      () => validateEnvironment({ ...multiTenantEnvironment, [key]: '' }),
      new RegExp(`${key} is required`),
    );
  }
});

test('MP_SECRET_KEY compartida no activa el modo single-tenant', () => {
  assert.throws(
    () => validateEnvironment(sharedEnvironment),
    /Invalid multi-tenant environment/,
  );
});

test('informa todas las variables faltantes sin mostrar valores', () => {
  assert.throws(
    () => validateEnvironment({ MP_SECRET_KEY: 'private-value' }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /CONTROL_DATABASE_URL is required/);
      assert.match(error.message, /GUIDE_URL is required/);
      assert.doesNotMatch(error.message, /private-value/);
      return true;
    },
  );
});

test('rechaza variables single y multi mezcladas', () => {
  assert.throws(
    () =>
      validateEnvironment({
        ...singleTenantEnvironment,
        CONTROL_DATABASE_URL: multiTenantEnvironment.CONTROL_DATABASE_URL,
      }),
    /No mezclar variables single-tenant con: CONTROL_DATABASE_URL/,
  );
});
