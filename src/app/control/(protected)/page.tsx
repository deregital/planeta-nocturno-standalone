import { desc, eq, ne } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { type Route } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import TenantTable from '@/app/control/(protected)/tenants/tenant-table';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { controlAdmins, tenants } from '@/db/control/schema';
import {
  getHostname,
  getRequestHost,
  normalizeRootDomain,
} from '@/lib/tenancy/host';

export default async function ControlHomePage() {
  const requestHeaders = new Headers(await headers());
  const tenantList = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      databaseName: tenants.databaseName,
      createdByUsername: controlAdmins.username,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .leftJoin(
      controlAdmins,
      eq(tenants.createdByControlAdminId, controlAdmins.id),
    )
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
            Administrador de plataformas
          </p>
          <h1 className='text-3xl font-bold text-gray-900'>Plataformas</h1>
          <p className='mt-1 text-sm text-gray-600'>
            {tenantList.length} registradas · {activeTenants} activas
          </p>
        </div>
        <Button asChild>
          <Link href={'/tenants/new' as Route}>
            <Plus />
            Nueva plataforma
          </Link>
        </Button>
      </div>

      <TenantTable
        tenants={tenantList.map((tenant) => ({
          ...tenant,
          publicUrl: getTenantPublicUrl(tenant.slug, requestHeaders),
        }))}
      />
    </div>
  );
}

function getTenantPublicUrl(slug: string, requestHeaders: Headers) {
  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
  const requestHost = getRequestHost(requestHeaders);
  const hostname = getHostname(requestHost);
  const forwardedProtocol = requestHeaders
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const protocol =
    forwardedProtocol === 'http' || forwardedProtocol === 'https'
      ? forwardedProtocol
      : hostname === 'localhost' || hostname.endsWith('.localhost')
        ? 'http'
        : 'https';
  const port = new URL(`${protocol}://${requestHost}`).port;

  return `${protocol}://${slug}.${rootDomain}${port ? `:${port}` : ''}`;
}
