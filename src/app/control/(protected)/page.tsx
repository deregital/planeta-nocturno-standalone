import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { Plus, Trash2 } from 'lucide-react';
import { type Route } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import TenantTable from '@/app/control/(protected)/tenants/tenant-table';
import TenantTagsManager from '@/components/control/TenantTagsManager';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlAdmins, tenants } from '@/db/control/schema';
import { requireAnyPermissionOrRedirect } from '@/server/control/can-manage-tenants';
import { getControlLandingPath } from '@/server/control/landing-path';
import {
  TENANT_READ_PERMISSIONS,
  tenantVisibilityFilter,
} from '@/server/control/tenant-access';
import { getTenantPublicUrl } from '@/server/control/tenant-public-url';
import { getControlAdminTenantTags } from '@/server/control/tenant-tags';

export default async function ControlHomePage() {
  const landingPath = (await getControlLandingPath()) as Route;
  const { permissions, session } = await requireAnyPermissionOrRedirect(
    TENANT_READ_PERMISSIONS,
    landingPath === '/' ? ('/users' as Route) : landingPath,
  );
  const requestHeaders = new Headers(await headers());
  const { tags, tagIdsByTenant } = await getControlAdminTenantTags(
    session.user.id,
  );
  const tenantList = await getControlDb()
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
        ne(tenants.status, 'deleted'),
        isNull(tenants.deletedAt),
        tenantVisibilityFilter(session.user.id, permissions),
      ),
    )
    .orderBy(desc(tenants.createdAt));

  const activeTenants = tenantList.filter(
    (tenant) => tenant.status === 'active',
  ).length;

  return (
    <div className='min-w-0 space-y-6'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-accent'>
            Gestión de plataformas
          </p>
          <h1 className='text-2xl font-bold text-gray-900 sm:text-3xl'>
            Plataformas
          </h1>
          <p className='mt-1 text-sm text-gray-600'>
            {tenantList.length} registradas · {activeTenants} activas
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <TenantTagsManager tags={tags} />
          <Button asChild variant='ghost' className='flex-1 sm:flex-none'>
            <Link href={'/trash' as Route}>
              <Trash2 />
              Papelera
            </Link>
          </Button>
          {permissions.includes('tenants:create') && (
            <Button asChild className='flex-1 sm:flex-none'>
              <Link href={'/tenants/new' as Route}>
                <Plus />
                Nueva plataforma
              </Link>
            </Button>
          )}
        </div>
      </div>

      <TenantTable
        permissions={permissions}
        tags={tags}
        tenants={tenantList.map((tenant) => ({
          ...tenant,
          tagIds: tagIdsByTenant.get(tenant.id) ?? [],
          publicUrl: getTenantPublicUrl(tenant.slug, requestHeaders),
        }))}
      />
    </div>
  );
}
