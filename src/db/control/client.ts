import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from '@/db/control/schema';

let controlDb: ReturnType<typeof createControlDb> | undefined;

export function getControlDb() {
  controlDb ??= createControlDb();
  return controlDb;
}

function createControlDb() {
  const connectionUrl = process.env.CONTROL_DATABASE_URL?.trim();
  if (!connectionUrl) throw new Error('CONTROL_DATABASE_URL is required');

  return drizzle(connectionUrl, { schema });
}
