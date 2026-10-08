import 'server-only';

import { and, desc, eq, inArray, or } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants, tenantSlugAliases } from '@/db/control/schema';
import {
  getRequestHost,
  getRequestOrigin,
  normalizeRootDomain,
  replaceTenantSubdomain,
  resolveMultiTenantHost,
  TENANT_ID_HEADER,
} from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';
import { activeTenantSlugAlias } from '@/server/control/tenant-slug';

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
      contactEmail: singleTenantConfig.contactEmail,
      description: singleTenantConfig.description,
      faviconUrl: singleTenantConfig.faviconUrl,
      hue: singleTenantConfig.hue,
      saturation: singleTenantConfig.saturation,
      mercadoPagoAccessToken: singleTenantConfig.mercadoPagoAccessToken,
      mercadoPagoRefreshToken: singleTenantConfig.mercadoPagoRefreshToken,
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

  const tenant = await findTenantByHostSlug(target.slug);
  if (!tenant || headers.get(TENANT_ID_HEADER) !== tenant.slug) {
    throw new Error('The tenant header does not match the request host');
  }

  if (tenant.status !== 'active' || !tenant.databaseName) {
    throw new Error('The tenant does not have an active database');
  }

  const origin = getRequestOrigin(
    headers,
    tenant.slug === target.slug
      ? host
      : replaceTenantSubdomain(host, tenant.slug),
  );

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    publicUrl: origin,
    siteUrl: origin,
    contactEmail: tenant.contactEmail,
    description: tenant.description,
    faviconUrl: tenant.faviconUrl,
    hue: tenant.hue ?? 200,
    saturation: tenant.saturation ?? 100,
    mercadoPagoAccessToken: tenant.mpAccessToken,
    mercadoPagoRefreshToken: tenant.mpRefreshToken,
    database: { name: tenant.databaseName },
  };
}

type HostTenant = Awaited<ReturnType<typeof queryTenantByHostSlug>>;

// Los cambios hechos en otro proceso tardan hasta el TTL en verse.
const TENANT_LOOKUP_TTL_MS = 30_000;
// Acota la memoria ante subdominios inventados (DNS wildcard).
const TENANT_LOOKUP_MAX_ENTRIES = 500;

const tenantLookups = new Map<
  string,
  { tenant: Promise<HostTenant>; expiresAt: number }
>();

/** Busca por el subdominio actual o por uno anterior todavía vigente (alias). */
export function findTenantByHostSlug(slug: string): Promise<HostTenant> {
  const now = Date.now();
  const cached = tenantLookups.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  tenantLookups.delete(slug);
  if (tenantLookups.size >= TENANT_LOOKUP_MAX_ENTRIES) {
    const oldestSlug = tenantLookups.keys().next().value;
    if (oldestSlug !== undefined) tenantLookups.delete(oldestSlug);
  }

  const entry = {
    tenant: queryTenantByHostSlug(slug),
    expiresAt: now + TENANT_LOOKUP_TTL_MS,
  };
  entry.tenant.catch(() => {
    if (tenantLookups.get(slug) === entry) tenantLookups.delete(slug);
  });
  tenantLookups.set(slug, entry);
  return entry.tenant;
}

export function invalidateTenantLookups() {
  tenantLookups.clear();
}

async function queryTenantByHostSlug(slug: string) {
  const db = getControlDb();
  const aliasTenantIds = db
    .select({ id: tenantSlugAliases.tenantId })
    .from(tenantSlugAliases)
    .where(and(eq(tenantSlugAliases.slug, slug), activeTenantSlugAlias));

  const [tenant] = await db
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
      databaseName: tenants.databaseName,
      status: tenants.status,
    })
    .from(tenants)
    .where(or(eq(tenants.slug, slug), inArray(tenants.id, aliasTenantIds)))
    .orderBy(desc(eq(tenants.slug, slug)))
    .limit(1);

  return tenant ?? null;
}

function getConfiguredRootDomain() {
  const value = process.env.ROOT_DOMAIN;
  if (!value) throw new Error('ROOT_DOMAIN is required');
  return normalizeRootDomain(value);
}
