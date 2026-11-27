import 'server-only';

import type { Db } from '@/drizzle';

import { normalizeRootDomain } from '@/lib/tenancy/host';
import { getSingleTenantConfig } from '@/server/config/single-tenant-config';
import { getActiveTenants } from '@/server/control/calendar-tenants';
import { getTenantPublicUrl } from '@/server/control/tenant-public-url';
import { getInstanceDb } from '@/server/instance/get-instance-db';

export type PlutoTenant = {
  /** `null` en una instancia de una sola productora. */
  slug: string | null;
  name: string;
  url: string;
  getDb: () => Promise<Db>;
};

export type PlutoInstance = {
  mode: 'single' | 'multi';
  name: string;
  url: string;
  tenants: PlutoTenant[];
};

/**
 * Las productoras de esta instancia, sea cual sea el host del pedido: en
 * multi-tenant salen de la base de control (las activas con base).
 */
export async function getPlutoInstance(
  requestHeaders: Headers,
): Promise<PlutoInstance> {
  const single = getSingleTenantConfig();
  if (single) {
    return {
      mode: 'single',
      name: single.name,
      url: single.publicUrl,
      tenants: [
        {
          slug: null,
          name: single.name,
          url: single.publicUrl,
          getDb: () => getInstanceDb({ url: single.databaseUrl }),
        },
      ],
    };
  }

  const rootDomain = normalizeRootDomain(process.env.ROOT_DOMAIN ?? '');
  const tenants = await getActiveTenants();
  return {
    mode: 'multi',
    name: rootDomain,
    url: `https://${rootDomain}`,
    tenants: tenants.map((tenant) => ({
      slug: tenant.slug,
      name: tenant.name,
      url: getTenantPublicUrl(tenant.slug, requestHeaders),
      getDb: () => getInstanceDb({ name: tenant.databaseName }),
    })),
  };
}

/** Qué código corre en este deploy (Vercel lo expone en tiempo de ejecución). */
export function getCodeVersion() {
  return {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    commitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
}
