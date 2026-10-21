import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';

import { getTenantDatabaseUrl } from '@/server/neon/get-database-url';
import {
  ensureTenantSuperadmin,
  getSuperadminCredentials,
} from '@/server/tenancy/superadmin';

type TenantDatabase = {
  slug: string;
  database_name: string;
};

async function main() {
  const credentials = getSuperadminCredentials();
  const controlDatabaseUrl = process.env.CONTROL_DATABASE_URL?.trim();
  if (!controlDatabaseUrl) throw new Error('CONTROL_DATABASE_URL is required');

  const controlClient = new Client({ connectionString: controlDatabaseUrl });
  await controlClient.connect();
  let tenantDatabases: TenantDatabase[];
  try {
    ({ rows: tenantDatabases } = await controlClient.query<TenantDatabase>(
      `select slug, database_name
       from tenants
       where database_name is not null
         and status in ('active', 'suspended')
       order by id`,
    ));
  } finally {
    await controlClient.end();
  }

  let failed = 0;
  for (const tenant of tenantDatabases) {
    const pool = new Pool({
      connectionString: await getTenantDatabaseUrl(tenant.database_name),
      max: 1,
    });
    try {
      const result = await ensureTenantSuperadmin(drizzle(pool), credentials);
      console.log(
        `${tenant.slug}: superadmin ${result.created ? 'created' : 'updated'}`,
      );
    } catch (error) {
      failed++;
      console.error(
        `${tenant.slug}: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      await pool.end();
    }
  }

  console.log(
    `Processed ${tenantDatabases.length} tenant database(s), ${failed} failed`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
