import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';

export function createDb(
  connectionString: string,
  poolOptions?: Omit<PoolConfig, 'connectionString'>,
) {
  const pool = new Pool({ connectionString, ...poolOptions });

  return drizzle(pool, {
    schema: {
      ...relations,
      ...models,
    },
  });
}

export type Db = ReturnType<typeof createDb>;
