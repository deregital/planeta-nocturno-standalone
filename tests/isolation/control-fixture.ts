import { eq } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';

export async function createTenantRecord(name: string, slug: string) {
  const [tenant] = await getControlDb()
    .insert(tenants)
    .values({
      name,
      slug,
      contactEmail: `${slug}@example.com`,
      hue: 200,
      saturation: 80,
      status: 'provisioning',
    })
    .returning({ id: tenants.id, slug: tenants.slug });

  if (!tenant) throw new Error('No se pudo crear el tenant de prueba');
  return tenant;
}

export async function activateTenantRecord(
  tenantId: number,
  databaseName: string,
) {
  await getControlDb()
    .update(tenants)
    .set({ databaseName, status: 'active', updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

export async function deleteTenantRecord(tenantId: number) {
  await getControlDb().delete(tenants).where(eq(tenants.id, tenantId));
}
