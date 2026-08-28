import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

const controlDatabaseUrl = process.env.CONTROL_DATABASE_URL?.trim();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/control/schema.ts',
  out: './drizzle/control',
  ...(controlDatabaseUrl ? { dbCredentials: { url: controlDatabaseUrl } } : {}),
});
