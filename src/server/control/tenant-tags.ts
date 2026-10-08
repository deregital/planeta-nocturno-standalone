import 'server-only';

import { asc, eq } from 'drizzle-orm';

import { getControlDb } from '@/db/control/client';
import { tenantTagAssignments, tenantTags } from '@/db/control/schema';

export type TenantTag = {
  id: string;
  name: string;
  color: string;
  tenantCount: number;
};

export async function getControlAdminTenantTags(adminId: string) {
  const db = getControlDb();
  const [tags, assignments] = await Promise.all([
    db
      .select({
        id: tenantTags.id,
        name: tenantTags.name,
        color: tenantTags.color,
      })
      .from(tenantTags)
      .where(eq(tenantTags.controlAdminId, adminId))
      .orderBy(asc(tenantTags.name)),
    db
      .select({
        tagId: tenantTagAssignments.tagId,
        tenantId: tenantTagAssignments.tenantId,
      })
      .from(tenantTagAssignments)
      .innerJoin(tenantTags, eq(tenantTagAssignments.tagId, tenantTags.id))
      .where(eq(tenantTags.controlAdminId, adminId)),
  ]);

  const tagIdsByTenant = new Map<number, string[]>();
  const tenantCountByTag = new Map<string, number>();
  for (const { tagId, tenantId } of assignments) {
    const tenantTagIds = tagIdsByTenant.get(tenantId);
    if (tenantTagIds) tenantTagIds.push(tagId);
    else tagIdsByTenant.set(tenantId, [tagId]);
    tenantCountByTag.set(tagId, (tenantCountByTag.get(tagId) ?? 0) + 1);
  }

  return {
    tags: tags
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'es', { sensitivity: 'base' }),
      )
      .map(
        (tag): TenantTag => ({
          ...tag,
          tenantCount: tenantCountByTag.get(tag.id) ?? 0,
        }),
      ),
    tagIdsByTenant,
  };
}
