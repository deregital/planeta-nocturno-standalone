import { and, eq, ne } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';

export const CUSTOM_ID_TAKEN_ERROR =
  'Este ID ya está asignado a otra plataforma';

export async function getCustomIdAvailabilityError(
  customId: string | null,
  excludeTenantId?: number,
): Promise<string | null> {
  if (!customId) return null;

  const filters = [
    eq(tenants.customId, customId),
    ne(tenants.status, 'deleted'),
  ];
  if (excludeTenantId !== undefined) {
    filters.push(ne(tenants.id, excludeTenantId));
  }

  const [existing] = await getControlDb()
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(...filters))
    .limit(1);

  return existing ? CUSTOM_ID_TAKEN_ERROR : null;
}

export function isCustomIdUniqueViolation(error: unknown) {
  const postgresError = unwrapPostgresError(error);
  if (postgresError?.code !== '23505') return false;

  if (postgresError.constraint === 'tenants_custom_id_unique') return true;

  return postgresError.detail?.includes('custom_id') ?? false;
}

export function isUniqueViolation(error: unknown) {
  return unwrapPostgresError(error)?.code === '23505';
}

function unwrapPostgresError(error: unknown) {
  let current: unknown = error;

  for (let depth = 0; depth < 5; depth++) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      typeof current.code === 'string'
    ) {
      return current as { code: string; constraint?: string; detail?: string };
    }

    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause;
      continue;
    }

    break;
  }

  return null;
}
