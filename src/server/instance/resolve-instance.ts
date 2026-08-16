import 'server-only';

import { eq } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import {
  getHostname,
  getRequestHost,
  normalizeRootDomain,
  resolveMultiTenantHost,
} from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';

export type ResolvedInstance = {
  tenantId: number | null;
  slug: string | null;
  name: string;
  publicUrl: string;
  siteUrl: string;
  contactEmail: string | null;
  description: string | null;
  faviconUrl: string | null;
  hue: number;
  saturation: number;
  mercadoPagoAccessToken: string | null;
  mercadoPagoRefreshToken: string | null;
  mercadoPagoSecretKey: string | null;
  database: { url: string } | { name: string };
};

export async function resolveInstance(
  headers: Headers,
): Promise<ResolvedInstance> {
  const singleTenantConfig = getSingleTenantConfig();

  if (singleTenantConfig) {
    return {
      tenantId: null,
      slug: null,
      name: singleTenantConfig.name,
      publicUrl: singleTenantConfig.publicUrl,
      siteUrl: singleTenantConfig.siteUrl,
      contactEmail: singleTenantConfig.contactEmail ?? null,
      description: singleTenantConfig.description ?? null,
      faviconUrl: singleTenantConfig.faviconUrl ?? null,
      hue: singleTenantConfig.hue,
      saturation: singleTenantConfig.saturation,
      mercadoPagoAccessToken: singleTenantConfig.mercadoPagoAccessToken ?? null,
      mercadoPagoRefreshToken:
        singleTenantConfig.mercadoPagoRefreshToken ?? null,
      mercadoPagoSecretKey: singleTenantConfig.mercadoPagoSecretKey ?? null,
      database: { url: singleTenantConfig.databaseUrl },
    };
  }

  return resolveMultiTenantInstance(headers);
}

async function resolveMultiTenantInstance(
  headers: Headers,
): Promise<ResolvedInstance> {
  const host = getRequestHost(headers);
  const target = resolveMultiTenantHost(host, getConfiguredRootDomain());

  if (target.type !== 'tenant') {
    throw new Error('No tenant is associated with this host');
  }

  const tenant = await findTenantBySlug(target.slug);

  if (tenant?.status !== 'active' || !tenant.databaseName) {
    throw new Error('The tenant does not have an active database');
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    publicUrl: getRequestOrigin(headers, host),
    siteUrl: getRequestOrigin(headers, host),
    contactEmail: tenant.contactEmail,
    description: tenant.description,
    faviconUrl: tenant.faviconUrl,
    hue: tenant.hue ?? 200,
    saturation: tenant.saturation ?? 100,
    mercadoPagoAccessToken: tenant.mpAccessToken,
    mercadoPagoRefreshToken: tenant.mpRefreshToken,
    mercadoPagoSecretKey: tenant.mpSecretKey,
    database: { name: tenant.databaseName },
  };
}

export async function findTenantBySlug(slug: string) {
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
      mpAccessToken: tenants.mpAccessToken,
      mpRefreshToken: tenants.mpRefreshToken,
      mpSecretKey: tenants.mpSecretKey,
      databaseName: tenants.databaseName,
      status: tenants.status,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  return tenant ?? null;
}

function getConfiguredRootDomain() {
  const value = process.env.ROOT_DOMAIN;
  if (!value) throw new Error('ROOT_DOMAIN is required');
  return normalizeRootDomain(value);
}

function getRequestOrigin(headers: Headers, host: string) {
  const forwardedProtocol = headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const hostname = getHostname(host);
  const protocol =
    forwardedProtocol === 'http' || forwardedProtocol === 'https'
      ? forwardedProtocol
      : hostname === 'localhost' || hostname.endsWith('.localhost')
        ? 'http'
        : 'https';

  return `${protocol}://${host.toLowerCase()}`;
}
