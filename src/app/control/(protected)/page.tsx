import { desc, ne } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import TenantTable from '@/app/control/(protected)/tenants/tenant-table';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';

export default async function ControlHomePage() {
  const tenantList = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
      createdByControlAdminId: tenants.createdByControlAdminId,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .where(ne(tenants.status, 'deleted'))
    .orderBy(desc(tenants.createdAt));

  const activeTenants = tenantList.filter(
    (tenant) => tenant.status === 'active',
  ).length;

  return (
    <div className='space-y-6'>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-sm font-medium text-accent'>
            Administrador de páginas
          </p>
          <h1 className='text-3xl font-bold text-gray-900'>Páginas</h1>
          <p className='mt-1 text-sm text-gray-600'>
            {tenantList.length} registradas · {activeTenants} activas
          </p>
        </div>
        <Button asChild>
          <Link href={'/tenants/new' as Route}>
            <Plus />
            Nueva página
          </Link>
        </Button>
      </div>

      <TenantTable tenants={tenantList} />
    </div>
  );
}
