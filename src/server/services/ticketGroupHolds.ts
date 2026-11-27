import type { PaymentMethod } from '@/server/types';

import { and, eq, inArray, isNull, lt, type SQL } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketGroup, ticketTypePerGroup } from '@/drizzle/schema';
import { CHECKOUT_HOLD_TTL_MS } from '@/server/payments/constants';
import {
  getPaymentProvider,
  PAYMENT_PROVIDERS,
} from '@/server/payments/registry';

export { CHECKOUT_HOLD_TTL_MS };

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

function olderThan(ms: number) {
  return lt(ticketGroup.createdAt, new Date(Date.now() - ms).toISOString());
}

/**
 * Hasta cuándo retiene el cupo una reserva sin pagar. null si no vence sola
 * (ya pagada, o un medio que cierra el staff).
 */
export function holdExpiresAt(group: {
  status: string;
  paymentMethod: PaymentMethod | null;
  createdAt: string;
}) {
  if (group.status !== 'BOOKED') return null;
  const ttl =
    group.paymentMethod === null
      ? CHECKOUT_HOLD_TTL_MS
      : getPaymentProvider(group.paymentMethod)?.hold?.releaseAfterMs;
  if (ttl === undefined) return null;
  return new Date(new Date(group.createdAt).getTime() + ttl).toISOString();
}

/**
 * Suelta el cupo de las reservas sin pagar vencidas de los eventos que cumplen
 * `eventCondition` (una condición sobre ticketGroup.eventId).
 *
 * - Sin medio de pago: se borran a los 10 minutos.
 * - Medios con `hold` (Mercado Pago): pasado `releaseAfterMs` sueltan el cupo
 *   pero conservan el grupo y las entradas, para que un pago tardío las
 *   entregue igual (ver markGroupPaid). Se borran pasado `deleteAfterMs`.
 * - Medios sin `hold` (transferencia) y cobro en el lugar: sólo las cierra el
 *   staff.
 */
export async function releaseExpiredHolds(db: Executor, eventCondition: SQL) {
  const bookedIn = (method: SQL) =>
    and(eventCondition, eq(ticketGroup.status, 'BOOKED'), method);

  await db
    .delete(ticketGroup)
    .where(
      and(
        bookedIn(isNull(ticketGroup.paymentMethod)),
        olderThan(CHECKOUT_HOLD_TTL_MS),
      ),
    );

  for (const provider of PAYMENT_PROVIDERS) {
    if (!provider.hold) continue;
    const method = eq(ticketGroup.paymentMethod, provider.method);

    await db.delete(ticketTypePerGroup).where(
      inArray(
        ticketTypePerGroup.ticketGroupId,
        db
          .select({ id: ticketGroup.id })
          .from(ticketGroup)
          .where(
            and(bookedIn(method), olderThan(provider.hold.releaseAfterMs)),
          ),
      ),
    );

    await db
      .delete(ticketGroup)
      .where(and(bookedIn(method), olderThan(provider.hold.deleteAfterMs)));
  }
}

export function eventHoldCondition(eventId: string) {
  return eq(ticketGroup.eventId, eventId);
}
