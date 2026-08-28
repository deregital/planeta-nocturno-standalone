import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

import { getTenantDatabaseUrl } from '@/server/neon/get-database-url';

const PRISMA_SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const PRISMA_MIGRATIONS = path.join(process.cwd(), 'prisma', 'migrations');
const PRISMA_CLI = path.join(
  process.cwd(),
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

type TenantDatabase = {
  slug: string;
  database_name: string;
};

async function main() {
  const controlDatabaseUrl = requiredEnvironmentValue('CONTROL_DATABASE_URL');
  const controlClient = new Client({ connectionString: controlDatabaseUrl });

  await controlClient.connect();
  try {
    const { rows: tenantDatabases } = await controlClient.query<TenantDatabase>(
      `select slug, database_name
       from tenants
       where database_name is not null
         and status in ('active', 'suspended')
       order by id`,
    );

    for (const tenant of tenantDatabases) {
      console.log(`Migrating tenant: ${tenant.slug}`);
      const databaseUrl = await getTenantDatabaseUrl(tenant.database_name);
      await ensurePrismaMigrationHistory(databaseUrl, tenant.slug);
      await runPrisma(
        ['migrate', 'deploy', '--schema', PRISMA_SCHEMA],
        databaseUrl,
      );
    }

    console.log(`Migrated ${tenantDatabases.length} tenant database(s)`);
  } finally {
    await controlClient.end();
  }
}

async function ensurePrismaMigrationHistory(
  databaseUrl: string,
  tenantSlug: string,
) {
  const tenantClient = new Client({ connectionString: databaseUrl });
  await tenantClient.connect();

  let hasExistingTables = false;
  let hasDrizzleHistory = false;
  let hasPrismaHistory = false;

  try {
    const { rows } = await tenantClient.query<{
      drizzle_history: string | null;
      prisma_history: string | null;
    }>(
      `select
         to_regclass('drizzle.__drizzle_migrations')::text as drizzle_history,
         to_regclass('public._prisma_migrations')::text as prisma_history`,
    );
    hasDrizzleHistory = Boolean(rows[0]?.drizzle_history);
    hasPrismaHistory = Boolean(rows[0]?.prisma_history);

    if (hasPrismaHistory && !hasDrizzleHistory) return;

    const { rows: existingTables } = await tenantClient.query(
      `select 1
       from information_schema.tables
       where table_schema = 'public'
         and table_name <> '_prisma_migrations'
       limit 1`,
    );
    hasExistingTables = existingTables.length > 0;
  } finally {
    await tenantClient.end();
  }

  if (!hasExistingTables) return;
  if (!hasDrizzleHistory) {
    throw new Error(
      `Tenant ${tenantSlug} has no recognized migration history; migration cancelled`,
    );
  }

  console.log(`Checking Prisma baseline for tenant: ${tenantSlug}`);
  const diffExitCode = await runPrisma(
    [
      'migrate',
      'diff',
      '--from-schema-datasource',
      PRISMA_SCHEMA,
      '--to-schema-datamodel',
      PRISMA_SCHEMA,
      '--exit-code',
    ],
    databaseUrl,
    [0, 2],
  );

  if (diffExitCode === 2) {
    throw new Error(
      `Tenant ${tenantSlug} does not match prisma/schema.prisma; baseline cancelled`,
    );
  }

  const migrationNames = (
    await readdir(PRISMA_MIGRATIONS, { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const appliedMigrationNames = hasPrismaHistory
    ? await getAppliedPrismaMigrations(databaseUrl)
    : new Set<string>();

  for (const migrationName of migrationNames) {
    if (appliedMigrationNames.has(migrationName)) continue;

    await runPrisma(
      [
        'migrate',
        'resolve',
        '--applied',
        migrationName,
        '--schema',
        PRISMA_SCHEMA,
      ],
      databaseUrl,
    );
  }

  const cleanupClient = new Client({ connectionString: databaseUrl });
  await cleanupClient.connect();
  try {
    await cleanupClient.query('drop schema if exists drizzle cascade');
  } finally {
    await cleanupClient.end();
  }
}

async function getAppliedPrismaMigrations(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows } = await client.query<{ migration_name: string }>(
      `select migration_name
       from public._prisma_migrations
       where finished_at is not null
         and rolled_back_at is null`,
    );
    return new Set(rows.map((row) => row.migration_name));
  } finally {
    await client.end();
  }
}

function runPrisma(
  args: string[],
  databaseUrl: string,
  acceptedExitCodes = [0],
) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, [PRISMA_CLI, ...args], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      const exitCode = code ?? 1;
      if (acceptedExitCodes.includes(exitCode)) resolve(exitCode);
      else reject(new Error(`Prisma exited with code ${exitCode}`));
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
