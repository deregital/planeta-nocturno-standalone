import 'server-only';

import type { ControlPermission } from '@/lib/control/permissions';

import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { tenantVisibilityFilter } from '@/server/control/tenant-access';

export type CalendarTenant = {
  slug: string;
  name: string;
  databaseName: string;
  hue: number;
  saturation: number;
};

/** Tenants activos con base que el admin puede ver (misma regla que Plataformas). */
export async function getCalendarTenants(
  adminId: string,
  permissions: readonly ControlPermission[],
): Promise<CalendarTenant[]> {
  const rows = await getControlDb()
    .select({
      slug: tenants.slug,
      name: tenants.name,
      databaseName: tenants.databaseName,
      hue: tenants.hue,
      saturation: tenants.saturation,
    })
    .from(tenants)
    .where(
      and(
        eq(tenants.status, 'active'),
        isNull(tenants.deletedAt),
        isNotNull(tenants.databaseName),
        tenantVisibilityFilter(adminId, permissions),
      ),
    )
    .orderBy(asc(tenants.name));

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    databaseName: row.databaseName!,
    hue: row.hue ?? 200,
    saturation: row.saturation ?? 100,
  }));
}
