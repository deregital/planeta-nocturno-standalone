import type { PaymentContext, PaymentProvider } from '@/server/payments/types';

import { NextResponse } from 'next/server';

import { capturePurchaseCompleted } from '@/server/analytics/purchase-events';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import {
  deliverPaidTicketGroup,
  markGroupPaid,
  updateTicketGroupStatus,
} from '@/server/services/ticketGroup';

/** Recibe el aviso de un medio de pago y, si el pago se aprobó, entrega las entradas. */
export async function handlePaymentNotification(
  request: Request,
  provider: PaymentProvider,
) {
  if (!provider.parseNotification) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const ctx = await resolveRequestContext(request.headers);
  let notification: Awaited<ReturnType<typeof provider.parseNotification>>;
  try {
    notification = await provider.parseNotification(request, ctx);
  } catch (error) {
    // No se pudo verificar el pago con el proveedor: 500 para que reintente.
    logger.error('Payment webhook verification failed', {
      operation: 'payment_webhook',
      method: provider.method,
      error,
    });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }
  if (notification instanceof Response) return notification;

  const { ticketGroupId } = notification;
  const log = { operation: 'payment_webhook', method: provider.method };

  if (notification.status !== 'PAID') {
    logger.info('Payment webhook ignored', { ...log, ticketGroupId });
    return new NextResponse(null, { status: 200 });
  }

  logger.info('Payment webhook accepted', { ...log, ticketGroupId });

  try {
    await fulfillTicketGroup(ctx, provider, ticketGroupId);
  } catch (error) {
    logger.error('Payment webhook fulfillment failed', {
      ...log,
      ticketGroupId,
      error,
    });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_SERVER_ERROR' },
      { status: 500 },
    );
  }

  return new NextResponse(null, { status: 200 });
}

async function fulfillTicketGroup(
  { db, instance }: PaymentContext,
  provider: PaymentProvider,
  ticketGroupId: string,
) {
  const log = { operation: 'payment_webhook', method: provider.method };

  // El aviso se reintenta (y un mismo pago puede avisarse varias veces): las
  // entradas se mandan sólo la primera vez que el grupo pasa a PAID.
  const transitioned = await markGroupPaid(db, ticketGroupId);
  if (!transitioned) {
    logger.warn('Payment webhook for an already paid ticket group', {
      ...log,
      ticketGroupId,
    });
    return;
  }

  let delivery: Awaited<ReturnType<typeof deliverPaidTicketGroup>>;
  try {
    delivery = await deliverPaidTicketGroup(db, instance, ticketGroupId);
  } catch (error) {
    // Vuelve a BOOKED para que el reintento del aviso entregue de nuevo.
    await updateTicketGroupStatus(db, ticketGroupId, 'BOOKED');
    throw error;
  }
  const { eventId, ticketCount } = delivery;

  await capturePurchaseCompleted(db, instance, {
    ticketGroupId,
    paymentMethod: provider.analyticsName,
  });

  logger.info('Payment webhook fulfillment completed', {
    ...log,
    ticketGroupId,
    eventId,
    ticketCount,
  });
}
