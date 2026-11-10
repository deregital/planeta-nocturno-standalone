import 'server-only';

import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { eventXorganizer, eventXUser } from '@/drizzle/schema';
import { hasPermission, type TenantPermission } from '@/lib/rbac/permissions';

type ScanAccess = {
  userId: string;
  permissions: readonly TenantPermission[] | ReadonlySet<TenantPermission>;
};

/**
 * Eventos que el usuario puede escanear: con "Escanear entradas", los
 * asignados como personal o como organizador (todos con "Ver todos los
 * eventos"). Devuelve null cuando puede escanear cualquiera.
 */
export async function getScannableEventIds(
  db: Db,
  access: ScanAccess,
): Promise<string[] | null> {
  if (!hasPermission(access.permissions, 'scanner:use')) return [];
  if (hasPermission(access.permissions, 'events:read_all')) return null;

  const [asStaff, asOrganizer] = await Promise.all([
    db.query.eventXUser.findMany({
      where: eq(eventXUser.b, access.userId),
      columns: { a: true },
    }),
    db.query.eventXorganizer.findMany({
      where: eq(eventXorganizer.organizerId, access.userId),
      columns: { eventId: true },
    }),
  ]);

  return [
    ...new Set([
      ...asStaff.map((row) => row.a),
      ...asOrganizer.map((row) => row.eventId),
    ]),
  ];
}

export async function canScanEvent(
  db: Db,
  access: ScanAccess,
  eventId: string,
) {
  const eventIds = await getScannableEventIds(db, access);
  return eventIds === null || eventIds.includes(eventId);
}
