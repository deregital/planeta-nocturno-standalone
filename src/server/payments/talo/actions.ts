import type { PaymentContext } from '@/server/payments/types';

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { ticketGroup, ticketTypePerGroup } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';
import {
  readTaloDetails,
  requestTaloRefund,
  saveTaloDetails,
  taloProvider,
  type TaloPaymentDetails,
} from '@/server/payments/providers/talo';
import {
  getTaloPayment,
  setTaloPaymentPrice,
} from '@/server/payments/talo/client';
import { getTaloConnection } from '@/server/payments/talo/connection';
import { fulfillTicketGroup } from '@/server/payments/webhook';

async function loadTaloPurchase(ctx: PaymentContext, ticketGroupId: string) {
  const group = await ctx.db.query.ticketGroup.findFirst({
    where: and(
      eq(ticketGroup.id, ticketGroupId),
      eq(ticketGroup.paymentMethod, 'TALO'),
    ),
    columns: {
      id: true,
      status: true,
      paymentReference: true,
      paymentDetails: true,
    },
  });
  const details = readTaloDetails(group?.paymentDetails);
  if (!group || !group.paymentReference || !details) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'La compra no existe o no se pagó con Talo',
    });
  }
  const connection = await getTaloConnection(ctx.db);
  if (!connection) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Talo no está conectado',
    });
  }
  return {
    group,
    paymentId: group.paymentReference,
    details,
    connection,
  };
}

/**
 * Pago de menos: el organizador acepta lo transferido. Se baja el precio en
 * Talo (que pasa a dar el pago por completo) y se entregan las entradas.
 */
export async function acceptTaloUnderpaid(
  ctx: PaymentContext,
  ticketGroupId: string,
) {
  const { group, paymentId, details, connection } = await loadTaloPurchase(
    ctx,
    ticketGroupId,
  );
  const received = details.received ?? 0;
  if (
    group.status !== 'BOOKED' ||
    details.issue !== 'UNDERPAID' ||
    received <= 0
  ) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'La compra no está esperando que se complete un pago de menos',
    });
  }
  if (details.refund && details.refund.status !== 'FAILED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Esta compra ya se devolvió',
    });
  }

  try {
    await setTaloPaymentPrice(connection, paymentId, received);
  } catch (error) {
    logger.error('Talo price update failed', { ticketGroupId, error });
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: 'Talo no aceptó el cambio de precio. Probá de nuevo en un rato.',
    });
  }

  // Antes de entregar: el aviso que manda Talo por el cambio de precio puede
  // llegar ya, y no tiene que tratarse como un pago tardío.
  await saveTaloDetails(ctx, ticketGroupId, {
    ...details,
    amount: received,
    issue: null,
    accepted: true,
  });
  await ctx.db
    .update(ticketGroup)
    .set({ totalAmount: received.toFixed(2) })
    .where(eq(ticketGroup.id, ticketGroupId));

  await fulfillTicketGroup(ctx, taloProvider, ticketGroupId);
}

/**
 * Devuelve por Talo:
 * - pago de menos o tardío sin entregar: todo, y la compra libera las entradas;
 * - pago de más ya entregado: sólo la diferencia.
 */
export async function refundTaloPurchase(
  ctx: PaymentContext,
  ticketGroupId: string,
) {
  const { group, paymentId, details, connection } = await loadTaloPurchase(
    ctx,
    ticketGroupId,
  );
  if (details.refund && details.refund.status !== 'FAILED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message:
        details.refund.status === 'PENDING'
          ? 'Ya hay una devolución en curso para esta compra'
          : 'Esta compra ya se devolvió',
    });
  }

  const received = details.received ?? 0;
  let refund: { type: 'FULL' | 'PARTIAL'; amount: number };
  if (
    group.status === 'BOOKED' &&
    (details.issue === 'UNDERPAID' || details.issue === 'LATE') &&
    received > 0
  ) {
    refund = { type: 'FULL', amount: received };
  } else if (
    group.status === 'PAID' &&
    details.issue === 'OVERPAID' &&
    received > details.amount
  ) {
    refund = { type: 'PARTIAL', amount: received - details.amount };
  } else {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No hay nada para devolver en esta compra',
    });
  }

  const state = await requestTaloRefund(connection, paymentId, refund);
  if (!state) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message:
        'Talo no aceptó la devolución. Hacela desde tu panel de Talo o probá de nuevo en un rato.',
    });
  }
  await saveTaloDetails(ctx, ticketGroupId, { ...details, refund: state });

  // Cancelada: las entradas vuelven a estar a la venta.
  if (group.status === 'BOOKED') {
    await ctx.db
      .delete(ticketTypePerGroup)
      .where(eq(ticketTypePerGroup.ticketGroupId, ticketGroupId));
  }
  return state;
}

/**
 * Actualiza las devoluciones en curso de estas compras. Talo no avisa cuando
 * terminan: se leen del pago.
 */
export async function refreshTaloRefunds(
  ctx: PaymentContext,
  purchases: {
    id: string;
    paymentMethod: string | null;
    paymentReference: string | null;
    paymentDetails: unknown;
  }[],
) {
  const pending = purchases
    .filter((p) => p.paymentMethod === 'TALO' && p.paymentReference)
    .map((p) => ({ ...p, details: readTaloDetails(p.paymentDetails) }))
    .filter(
      (p): p is typeof p & { details: TaloPaymentDetails } =>
        p.details?.refund?.status === 'PENDING',
    )
    .slice(0, 10);
  if (pending.length === 0) return [];

  const connection = await getTaloConnection(ctx.db);
  if (!connection) return [];

  const updated: string[] = [];
  for (const purchase of pending) {
    try {
      const payment = await getTaloPayment(
        connection,
        purchase.paymentReference!,
      );
      const status = payment.refunds?.at(-1)?.refund_status;
      if (status && status !== 'PENDING' && purchase.details.refund) {
        await saveTaloDetails(ctx, purchase.id, {
          ...purchase.details,
          refund: { ...purchase.details.refund, status },
        });
        updated.push(purchase.id);
      }
    } catch (error) {
      logger.warn('Talo refund status check failed', {
        ticketGroupId: purchase.id,
        error,
      });
    }
  }
  return updated;
}
