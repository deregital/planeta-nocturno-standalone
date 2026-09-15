import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';

import TenantTable from '@/app/control/(protected)/tenants/tenant-table';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlAdmins, tenants } from '@/db/control/schema';
import { requireAnyPermissionOrRedirect } from '@/server/control/can-manage-tenants';
import {
  TENANT_READ_PERMISSIONS,
  tenantVisibilityFilter,
} from '@/server/control/tenant-access';

export default async function TenantTrashPage() {
  const { permissions, session } = await requireAnyPermissionOrRedirect(
    TENANT_READ_PERMISSIONS,
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
    .where(
      and(
        isNotNull(tenants.deletedAt),
        ne(tenants.status, 'deleted'),
        tenantVisibilityFilter(session.user.id, permissions),
      ),
    )
    .orderBy(desc(tenants.deletedAt));

  return (
    <div className='min-w-0 space-y-6'>
      <Button asChild variant='ghost'>
        <Link href='/'>← Volver</Link>
      </Button>

      <div className='min-w-0'>
        <p className='text-sm font-medium text-accent'>
          Gestión de plataformas
        </p>
        <h1 className='text-2xl font-bold text-gray-900 sm:text-3xl'>
          Papelera
        </h1>
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
