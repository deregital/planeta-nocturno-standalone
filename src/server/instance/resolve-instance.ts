import 'server-only';

import { and, eq } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import {
  getHostname,
  getSubdomain,
  normalizeRootDomain,
} from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';

const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'mail',
  'static',
  'www',
]);

export type ResolvedInstance = {
  tenantId: number | null;
  slug: string | null;
  name: string;
  publicUrl: string;
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
      database: { url: singleTenantConfig.databaseUrl },
    };
  }

  return resolveMultiTenantInstance(headers);
}

async function resolveMultiTenantInstance(
  headers: Headers,
): Promise<ResolvedInstance> {
  const host = headers.get('host') ?? '';
  const rootDomain = getRootDomain();
  const slug = getSubdomain(host, rootDomain);

  if (!slug || RESERVED_SUBDOMAINS.has(slug)) {
    throw new Error('No tenant is associated with this host');
  }

  const [tenant] = await getControlDb()
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      databaseName: tenants.databaseName,
    })
    .from(tenants)
    .where(and(eq(tenants.slug, slug), eq(tenants.status, 'active')))
    .limit(1);

  if (!tenant?.databaseName) {
    throw new Error('The tenant does not have an active database');
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    publicUrl: getRequestOrigin(headers, host),
    database: { name: tenant.databaseName },
  };
}

function getRootDomain() {
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
