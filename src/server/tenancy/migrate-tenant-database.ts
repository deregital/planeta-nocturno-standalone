import 'server-only';

import type { PoolClient } from 'pg';

import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';

const MIGRATIONS_DIRECTORY = path.join(process.cwd(), 'prisma', 'migrations');

type Migration = {
  name: string;
  checksum: string;
  sql: string;
};

type AppliedMigration = {
  id: string;
  checksum: string;
  migrationName: string;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

export class TenantMigrationError extends Error {
  constructor(cause: unknown) {
    super('Unable to migrate the tenant database', { cause });
    this.name = 'TenantMigrationError';
  }
}

export async function migrateTenantDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const client = await pool.connect();
    try {
      await createMigrationsTable(client);
      await applyPendingMigrations(client, await readMigrations());
    } finally {
      client.release();
    }
  } catch (error) {
    throw new TenantMigrationError(error);
  } finally {
    await pool.end();
  }
}

async function createMigrationsTable(client: PoolClient) {
  await client.query(`
    create table if not exists "_prisma_migrations" (
      id varchar(36) primary key not null,
      checksum varchar(64) not null,
      finished_at timestamptz,
      migration_name varchar(255) not null,
      logs text,
      rolled_back_at timestamptz,
      started_at timestamptz not null default now(),
      applied_steps_count integer not null default 0
    )
  `);
}

async function applyPendingMigrations(
  client: PoolClient,
  migrations: Migration[],
) {
  const result = await client.query<AppliedMigration>(`
    select
      id,
      checksum,
      migration_name as "migrationName",
      finished_at as "finishedAt",
      rolled_back_at as "rolledBackAt"
    from "_prisma_migrations"
    order by started_at
  `);
  const appliedMigrations = new Map(
    result.rows.map((migration) => [migration.migrationName, migration]),
  );

  for (const migration of migrations) {
    const applied = appliedMigrations.get(migration.name);
    if (applied?.finishedAt && !applied.rolledBackAt) {
      if (applied.checksum !== migration.checksum) {
        throw new Error(`Migration checksum changed: ${migration.name}`);
      }
      continue;
    }
    if (applied && !applied.rolledBackAt) {
      throw new Error(`Migration previously failed: ${migration.name}`);
    }

    await applyMigration(client, migration);
  }
}

async function applyMigration(client: PoolClient, migration: Migration) {
  const migrationId = randomUUID();
  await client.query(
    `
      insert into "_prisma_migrations" (
        id,
        checksum,
        migration_name
      ) values ($1, $2, $3)
    `,
    [migrationId, migration.checksum, migration.name],
  );

  try {
    await client.query(migration.sql);
    await client.query(
      `
        update "_prisma_migrations"
        set finished_at = now(), applied_steps_count = 1
        where id = $1
      `,
      [migrationId],
    );
  } catch (error) {
    await client
      .query(`update "_prisma_migrations" set logs = $2 where id = $1`, [
        migrationId,
        getErrorMessage(error),
      ])
      .catch(() => undefined);
    throw error;
  }
}

async function readMigrations() {
  const entries = await readdir(MIGRATIONS_DIRECTORY, {
    withFileTypes: true,
  });
  const migrations: Migration[] = [];

  for (const entry of entries
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const migrationSql = await readFile(
      path.join(MIGRATIONS_DIRECTORY, entry.name, 'migration.sql'),
    );
    migrations.push({
      name: entry.name,
      checksum: createHash('sha256').update(migrationSql).digest('hex'),
      sql: migrationSql.toString('utf8'),
    });
  }

  return migrations;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
