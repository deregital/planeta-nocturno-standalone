import { and, eq, inArray, isNull, lt, type SQL } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketGroup, ticketTypePerGroup } from '@/drizzle/schema';

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

/** Una reserva que no llegó a un medio de pago (CONTINUAR sin COMPRAR) dura 10 minutos. */
export const CHECKOUT_HOLD_TTL_MS = 10 * 60 * 1000;
/** La preferencia de Mercado Pago deja de aceptar pagos a los 20 minutos de creada. */
export const MERCADO_PAGO_PREFERENCE_TTL_MS = 20 * 60 * 1000;
/**
 * Una reserva que pasó a Mercado Pago retiene el cupo hasta que su preferencia
 * venció, con margen para que llegue el aviso de pago.
 */
export const MERCADO_PAGO_HOLD_TTL_MS =
  CHECKOUT_HOLD_TTL_MS + MERCADO_PAGO_PREFERENCE_TTL_MS + 10 * 60 * 1000;
/**
 * Las entradas de una compra de Mercado Pago sin aprobar se guardan una semana:
 * un pago en revisión o en efectivo puede acreditarse días después.
 */
export const MERCADO_PAGO_UNPAID_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function olderThan(ms: number) {
  return lt(ticketGroup.createdAt, new Date(Date.now() - ms).toISOString());
}

/**
 * Suelta el cupo de las reservas sin pagar vencidas de los eventos que cumplen
 * `eventCondition` (una condición sobre ticketGroup.eventId).
 *
 * - Sin medio de pago: se borran a los 10 minutos.
 * - Mercado Pago: a los 40 minutos sueltan el cupo pero conservan el grupo y
 *   las entradas, para que un pago tardío las entregue igual (ver
 *   markMercadoPagoGroupPaid). Se borran a la semana.
 * - Transferencia y cobro en el lugar: sólo las cierra el staff.
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

  const mercadoPago = eq(ticketGroup.paymentMethod, 'MERCADO_PAGO');

  await db.delete(ticketTypePerGroup).where(
    inArray(
      ticketTypePerGroup.ticketGroupId,
      db
        .select({ id: ticketGroup.id })
        .from(ticketGroup)
        .where(and(bookedIn(mercadoPago), olderThan(MERCADO_PAGO_HOLD_TTL_MS))),
    ),
  );

  await db
    .delete(ticketGroup)
    .where(
      and(bookedIn(mercadoPago), olderThan(MERCADO_PAGO_UNPAID_RETENTION_MS)),
    );
}

export function eventHoldCondition(eventId: string) {
  return eq(ticketGroup.eventId, eventId);
}
