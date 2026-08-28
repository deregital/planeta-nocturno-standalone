import { spawn } from 'node:child_process';
import path from 'node:path';

import { Client } from 'pg';

import { getTenantDatabaseUrl } from '@/server/neon/get-database-url';

const SEED_SCRIPT = path.join(process.cwd(), 'src', 'drizzle', 'seed.ts');

type TenantDatabase = {
  database_name: string;
};

async function main() {
  const controlDatabaseUrl = requiredEnvironmentValue('CONTROL_DATABASE_URL');
  const tenantSlug = requiredEnvironmentValue('SEED_TENANT_SLUG');
  const controlClient = new Client({ connectionString: controlDatabaseUrl });

  await controlClient.connect();
  try {
    const { rows } = await controlClient.query<TenantDatabase>(
      `select database_name
       from tenants
       where slug = $1
         and database_name is not null
         and status in ('active', 'suspended')
       limit 1`,
      [tenantSlug],
    );
    const databaseName = rows[0]?.database_name;
    if (!databaseName) {
      throw new Error(`Active or suspended tenant not found: ${tenantSlug}`);
    }

    const databaseUrl = await getTenantDatabaseUrl(databaseName);
    console.log(`Seeding tenant: ${tenantSlug}`);
    await runSeed(databaseUrl);
  } finally {
    await controlClient.end();
  }
}

function runSeed(databaseUrl: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', SEED_SCRIPT], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Seed exited with code ${code ?? 1}`));
    });
  });
}

function requiredEnvironmentValue(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
