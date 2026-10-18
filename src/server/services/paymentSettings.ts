import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { event, paymentSettings, ticketType } from '@/drizzle/schema';

const SETTINGS_ID = 1;

export async function getTransferAlias(db: Db) {
  const settings = await db.query.paymentSettings.findFirst({
    where: eq(paymentSettings.id, SETTINGS_ID),
    columns: { transferAlias: true },
  });
  return settings?.transferAlias ?? null;
}

export async function setTransferAlias(db: Db, transferAlias: string | null) {
  const values = {
    transferAlias,
    updatedAt: new Date().toISOString(),
  };
  await db
    .insert(paymentSettings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: paymentSettings.id, set: values });
}

/** Eventos publicados y no terminados que venden entradas pagas. */
export async function hasActivePaidEvents(db: Db) {
  const [row] = await db
    .select({ id: event.id })
    .from(event)
    .innerJoin(ticketType, eq(ticketType.eventId, event.id))
    .where(
      and(
        eq(event.isActive, true),
        eq(event.isDeleted, false),
        or(
          isNull(event.endingDate),
          gt(event.endingDate, new Date().toISOString()),
        ),
        inArray(ticketType.category, ['PAID', 'TABLE']),
      ),
    )
    .limit(1);
  return Boolean(row);
}
