import 'server-only';

import { and, eq, gt, lte, sql } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants, tenantSlugAliases } from '@/db/control/schema';
import { TENANT_SLUG_ALIAS_TTL_MINUTES } from '@/lib/tenancy/host';
import { logger } from '@/server/observability/logger';
import { tenantSubdomainSchema } from '@/server/schemas/control-tenant';

const aliasExpiry = sql`now() - ${sql.raw(`interval '${TENANT_SLUG_ALIAS_TTL_MINUTES} minutes'`)}`;

/** Alias recientes: cubren compras y webhooks en curso al cambiar el subdominio. */
export const activeTenantSlugAlias = gt(
  tenantSlugAliases.createdAt,
  aliasExpiry,
);

export const TENANT_SLUG_TAKEN_ERROR = 'Ese subdominio ya está en uso';
const TENANT_SLUG_RECENTLY_RELEASED_ERROR = `Ese subdominio se liberó hace poco. Va a estar disponible ${TENANT_SLUG_ALIAS_TTL_MINUTES} minutos después del cambio`;

export type SubdomainAvailability = {
  available: boolean;
  message: string;
};

export async function getTenantSlugTakenError(
  slug: string,
  excludeTenantId?: number,
): Promise<string | null> {
  const db = getControlDb();
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (tenant && tenant.id !== excludeTenantId) return TENANT_SLUG_TAKEN_ERROR;

  const [alias] = await db
    .select({ tenantId: tenantSlugAliases.tenantId })
    .from(tenantSlugAliases)
    .where(and(eq(tenantSlugAliases.slug, slug), activeTenantSlugAlias))
    .limit(1);
  if (alias && alias.tenantId !== excludeTenantId) {
    return TENANT_SLUG_RECENTLY_RELEASED_ERROR;
  }

  return null;
}

export function deleteExpiredTenantSlugAliases() {
  return getControlDb()
    .delete(tenantSlugAliases)
    .where(lte(tenantSlugAliases.createdAt, aliasExpiry));
}

export async function getSubdomainAvailability(
  value: string,
  excludeTenantId?: number,
): Promise<SubdomainAvailability> {
  const validation = tenantSubdomainSchema.safeParse(value);
  if (!validation.success) {
    return {
      available: false,
      message: validation.error.issues[0]?.message ?? 'Subdominio inválido',
    };
  }

  try {
    const error = await getTenantSlugTakenError(
      validation.data,
      excludeTenantId,
    );
    return { available: !error, message: error ?? 'Subdominio disponible' };
  } catch (error) {
    logger.error('Unable to check subdomain availability', { error });
    return { available: false, message: 'No se pudo comprobar el subdominio' };
  }
}
