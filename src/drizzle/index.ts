import { drizzle } from 'drizzle-orm/node-postgres';

import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';

export function createDb(connectionString: string) {
  return drizzle(connectionString, {
    schema: {
      ...relations,
      ...models,
    },
  });
}

export type Db = ReturnType<typeof createDb>;
