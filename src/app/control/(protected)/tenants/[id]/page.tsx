import { and, desc, eq, ne } from 'drizzle-orm';
import { type Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import TenantEditForm from '@/app/control/(protected)/tenants/[id]/form';
import { Button } from '@/components/ui/button';
import { getControlDb } from '@/db/control/client';
import { tenants, tenantSlugAliases } from '@/db/control/schema';
import { requirePermissionOrRedirect } from '@/server/control/can-manage-tenants';
import { tenantVisibilityFilter } from '@/server/control/tenant-access';
import { activeTenantSlugAlias } from '@/server/control/tenant-slug';

const statusLabels = {
  provisioning: 'Preparando',
  active: 'Activa',
  suspended: 'Suspendida',
  failed: 'Fallida',
  deleting: 'Eliminando',
  deleted: 'Eliminada',
} as const;

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { permissions, session } = await requirePermissionOrRedirect(
    'tenants:update',
    '/' as Route,
  );
  const tenantId = Number((await params).id);
  if (!Number.isInteger(tenantId) || tenantId <= 0) notFound();

  const [tenant] = await getControlDb()
    .select({
      id: tenants.id,
      customId: tenants.customId,
      name: tenants.name,
      comments: tenants.comments,
      slug: tenants.slug,
      description: tenants.description,
      contactEmail: tenants.contactEmail,
      faviconUrl: tenants.faviconUrl,
      hue: tenants.hue,
      saturation: tenants.saturation,
      status: tenants.status,
      databaseName: tenants.databaseName,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, tenantId),
        ne(tenants.status, 'deleted'),
        tenantVisibilityFilter(session.user.id, permissions),
      ),
    )
    .limit(1);

  if (!tenant) notFound();

  const aliases = await getControlDb()
    .select({ slug: tenantSlugAliases.slug })
    .from(tenantSlugAliases)
    .where(
      and(eq(tenantSlugAliases.tenantId, tenant.id), activeTenantSlugAlias),
    )
    .orderBy(desc(tenantSlugAliases.createdAt));

  const rootDomain = process.env.ROOT_DOMAIN ?? '';

  return (
    <div className='space-y-6'>
      <Button asChild variant='ghost'>
        <Link href='/'>← Volver</Link>
      </Button>

      <div>
        <p className='text-sm font-medium text-accent'>
          {tenant.slug}
          {rootDomain ? `.${rootDomain}` : ''}
        </p>
        <h1 className='text-3xl font-bold text-gray-900'>
          Editar {tenant.name}
        </h1>
        <p className='mt-1 text-sm text-gray-600'>
          {statusLabels[tenant.status]}
          {tenant.databaseName ? '' : ' · Pendiente de configuración'}
        </p>
        {aliases.length > 0 && (
          <p className='mt-1 text-xs text-gray-500'>
            Redirigiendo temporalmente desde:{' '}
            {aliases.map((alias) => alias.slug).join(', ')}
          </p>
        )}
      </div>

      <TenantEditForm
        rootDomain={rootDomain}
        hasDatabase={Boolean(tenant.databaseName)}
        initialValues={{
          tenantId: String(tenant.id),
          customId: tenant.customId ?? '',
          name: tenant.name,
          slug: tenant.slug,
          comments: tenant.comments ?? '',
          description: tenant.description ?? '',
          contactEmail: tenant.contactEmail ?? '',
          faviconUrl: tenant.faviconUrl ?? '',
          hue: String(tenant.hue ?? 200),
          saturation: String(tenant.saturation ?? 100),
        }}
      />
    </div>
  );
}
