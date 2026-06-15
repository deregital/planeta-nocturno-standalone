import { eq, inArray, sql } from 'drizzle-orm';

import { type db } from '@/drizzle';

import { tag, userXTag } from '@/drizzle/schema';

export async function getTagIdsOwnedByUser(
  database: typeof db,
  userId: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: tag.id })
    .from(tag)
    .where(eq(tag.createdById, userId));
  return rows.map((row) => row.id);
}

export function buildUserXTagsRelation(ownedTagIds: string[]) {
  return {
    where: ownedTagIds.length ? inArray(userXTag.a, ownedTagIds) : sql`false`,
    with: {
      tag: true as const,
    },
  };
}

export async function assertTagOwnedByUser(
  database: typeof db,
  tagId: string,
  userId: string,
) {
  const ownedTag = await database.query.tag.findFirst({
    where: eq(tag.id, tagId),
    columns: { id: true, createdById: true },
  });

  if (!ownedTag || ownedTag.createdById !== userId) {
    throw new Error('No tienes permiso para modificar este grupo');
  }

  return ownedTag;
}
