import 'server-only';

import type { z } from 'zod';

import { hash } from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { user } from '@/drizzle/schema';
import { userSchema } from '@/server/schemas/user';
import {
  buildTenantDatabaseName,
  createTenantDatabase,
  deleteTenantDatabase,
  getTenantDatabaseUrl,
} from '@/server/neon/get-database-url';
import { migrateTenantDatabase } from '@/server/tenancy/migrate-tenant-database';

const tenantAdminSchema = userSchema.pick({
  name: true,
  password: true,
  email: true,
  fullName: true,
  gender: true,
  phoneNumber: true,
  dni: true,
  birthDate: true,
});

const provisionedTenantFields = {
  id: tenants.id,
  name: tenants.name,
  slug: tenants.slug,
  status: tenants.status,
  databaseName: tenants.databaseName,
};

export type ProvisionTenantInput = {
  tenantId: number;
  admin: z.input<typeof tenantAdminSchema>;
};

export class TenantProvisioningError extends Error {
  constructor(cause: unknown) {
    super('Unable to provision the tenant', { cause });
    this.name = 'TenantProvisioningError';
  }
}

export async function provisionTenant(input: ProvisionTenantInput) {
  const admin = tenantAdminSchema.parse(input.admin);
  const controlDb = getControlDb();
  const [tenant] = await controlDb
    .select(provisionedTenantFields)
    .from(tenants)
    .where(eq(tenants.id, input.tenantId))
    .limit(1);

  if (!tenant) throw new Error('Tenant not found');
  if (tenant.status === 'active' && tenant.databaseName) return tenant;
  if (tenant.status === 'deleting' || tenant.status === 'suspended') {
    throw new Error(`Tenant cannot be provisioned while ${tenant.status}`);
  }
  if (tenant.databaseName) {
    throw new Error('Tenant database requires manual cleanup before retrying');
  }

  const databaseName = buildTenantDatabaseName(tenant.id, tenant.slug);
  let databaseCreated = false;
  let databaseDeleted = false;

  await updateTenant(tenant.id, {
    status: 'provisioning',
    databaseName: null,
  });

  try {
    await createTenantDatabase(databaseName);
    databaseCreated = true;

    await updateTenant(tenant.id, { databaseName });

    const connectionString = await getTenantDatabaseUrl(databaseName);
    await migrateTenantDatabase(connectionString);
    await createTenantAdmin(connectionString, admin);

    const [activeTenant] = await controlDb
      .update(tenants)
      .set({
        databaseName,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id))
      .returning(provisionedTenantFields);

    if (!activeTenant)
      throw new Error('Tenant disappeared during provisioning');
    return activeTenant;
  } catch (error) {
    if (databaseCreated) {
      try {
        await deleteTenantDatabase(databaseName);
        databaseDeleted = true;
      } catch (cleanupError) {
        console.error('Unable to delete incomplete tenant database', {
          databaseName,
          error: cleanupError,
        });
      }
    }

    await updateTenant(tenant.id, {
      status: 'failed',
      databaseName: databaseDeleted
        ? null
        : databaseCreated
          ? databaseName
          : null,
    }).catch((updateError) => {
      console.error('Unable to mark tenant provisioning as failed', {
        tenantId: tenant.id,
        error: updateError,
      });
    });

    throw new TenantProvisioningError(error);
  }
}

async function createTenantAdmin(
  connectionString: string,
  admin: z.output<typeof tenantAdminSchema>,
) {
  const pool = new Pool({ connectionString, max: 1 });

  try {
    await drizzle(pool)
      .insert(user)
      .values({
        name: admin.name.trim(),
        password: await hash(admin.password, 10),
        email: admin.email,
        fullName: admin.fullName,
        role: 'ADMIN',
        gender: admin.gender,
        phoneNumber: admin.phoneNumber,
        dni: admin.dni,
        birthDate: admin.birthDate,
      });
  } finally {
    await pool.end();
  }
}

async function updateTenant(
  tenantId: number,
  values: Partial<Pick<typeof tenants.$inferInsert, 'status' | 'databaseName'>>,
) {
  await getControlDb()
    .update(tenants)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}
