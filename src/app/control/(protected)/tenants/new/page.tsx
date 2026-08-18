import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import TenantForm from '@/app/control/(protected)/tenants/new/form';
import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';

export const maxDuration = 60;

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string }>;
}) {
  const retryParam = (await searchParams).retry;
  const retryId = Number(retryParam);
  if (retryParam && (!Number.isInteger(retryId) || retryId <= 0)) notFound();

  const retryTenant = retryParam ? await getRetryTenant(retryId) : null;
  if (retryParam && !retryTenant) notFound();

  return (
    <div className='space-y-6'>
      <div>
        <p className='text-sm font-medium text-accent'>Control plane</p>
        <h1 className='text-3xl font-bold text-gray-900'>
          {retryTenant ? `Reintentar ${retryTenant.name}` : 'Nuevo tenant'}
        </h1>
        <p className='mt-1 text-sm text-gray-600'>
          Se creará la base, se aplicarán las migraciones y se dará de alta el
          administrador inicial.
        </p>
      </div>

      <TenantForm
        initialValues={
          retryTenant
            ? {
                tenantId: String(retryTenant.id),
                name: retryTenant.name,
                slug: retryTenant.slug,
                description: retryTenant.description ?? '',
                contactEmail: retryTenant.contactEmail ?? '',
                faviconUrl: retryTenant.faviconUrl ?? '',
                hue: String(retryTenant.hue ?? 200),
                saturation: String(retryTenant.saturation ?? 100),
                plan: retryTenant.plan,
              }
            : undefined
        }
      />
    </div>
  );
}

async function getRetryTenant(id: number) {
  const [tenant] = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      description: tenants.description,
      contactEmail: tenants.contactEmail,
      faviconUrl: tenants.faviconUrl,
      hue: tenants.hue,
      saturation: tenants.saturation,
      plan: tenants.plan,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.id, id),
        eq(tenants.status, 'failed'),
        isNull(tenants.databaseName),
      ),
    )
    .limit(1);

  return tenant ?? null;
}
