import 'server-only';

import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const TENANT_MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle', 'tenant');

export class TenantMigrationError extends Error {
  constructor(cause: unknown) {
    super('Unable to migrate the tenant database', { cause });
    this.name = 'TenantMigrationError';
  }
}

export async function migrateTenantDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: TENANT_MIGRATIONS_FOLDER,
    });
  } catch (error) {
    throw new TenantMigrationError(error);
  } finally {
    await pool.end();
  }
}
