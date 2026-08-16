import 'server-only';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { createDb, type Db } from '@/drizzle';

import { getTenantDatabaseUrl } from '@/server/neon/get-database-url';

const connections = new Map<string, Promise<Db>>();

export function getInstanceDb(database: ResolvedInstance['database']) {
  const key = 'url' in database ? 'single' : database.name;
  const existingConnection = connections.get(key);

  if (existingConnection) return existingConnection;

  const connection = createInstanceDb(database).catch((error) => {
    connections.delete(key);
    throw error;
  });
  connections.set(key, connection);

  return connection;
}

async function createInstanceDb(database: ResolvedInstance['database']) {
  const databaseUrl =
    'url' in database
      ? database.url
      : await getTenantDatabaseUrl(database.name);

  return createDb(databaseUrl);
}
