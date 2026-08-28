import { randomUUID } from 'node:crypto';

import { hash } from 'bcrypt';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { user } from '@/drizzle/schema';
import { migrateTenantDatabase } from '@/server/tenancy/migrate-tenant-database';

export type TestAdmin = {
  username: string;
  password: string;
  email: string;
  fullName: string;
};

export async function prepareTenantDatabase(
  connectionString: string,
  admin: TestAdmin,
) {
  await migrateTenantDatabase(connectionString);

  const pool = new Pool({ connectionString, max: 1 });
  try {
    await drizzle(pool)
      .insert(user)
      .values({
        name: admin.username,
        password: await hash(admin.password, 10),
        email: admin.email,
        fullName: admin.fullName,
        role: 'ADMIN',
        gender: 'other',
        phoneNumber: '',
        dni: `isolation-${randomUUID()}`,
        birthDate: '1900-01-01T00:00:00.000Z',
      });
  } finally {
    await pool.end();
  }
}
