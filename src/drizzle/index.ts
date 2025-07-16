import { drizzle } from 'drizzle-orm/node-postgres';
import * as relations from './relations';
import * as models from './schema';

export const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    ...relations,
    ...models,
  },
});
