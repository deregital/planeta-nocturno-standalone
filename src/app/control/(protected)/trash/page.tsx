import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';

import TenantTable from '@/app/control/(protected)/tenants/tenant-table';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlAdmins, tenants } from '@/db/control/schema';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';

export default async function TenantTrashPage() {
  const { permissions } = await requirePermissionOrRedirect(
    'tenants:read',
    '/' as Route,
  );
  const recycledTenants = await getControlDb()
    .select({
      id: tenants.id,
      customId: tenants.customId,
      comments: tenants.comments,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
      createdByUsername: controlAdmins.username,
      createdAt: tenants.createdAt,
      recycledAt: tenants.deletedAt,
    })
    .from(tenants)
    .leftJoin(
      controlAdmins,
      eq(tenants.createdByControlAdminId, controlAdmins.id),
    )
    .where(and(isNotNull(tenants.deletedAt), ne(tenants.status, 'deleted')))
    .orderBy(desc(tenants.deletedAt));

  return (
    <div className='space-y-6'>
      <Button asChild variant='ghost'>
        <Link href='/'>← Volver</Link>
      </Button>

      <div>
        <p className='text-sm font-medium text-accent'>
          Gestión de plataformas
        </p>
        <h1 className='text-3xl font-bold text-gray-900'>Papelera</h1>
        <p className='mt-1 text-sm text-gray-600'>
          {recycledTenants.length} plataformas suspendidas
        </p>
      </div>

      <TenantTable
        recycled
        permissions={permissions}
        tenants={recycledTenants.map((tenant) => ({
          ...tenant,
          publicUrl: '',
        }))}
      />
    </div>
  );
}
