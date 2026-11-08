import { NextResponse } from 'next/server';
import { z } from 'zod';

import { capturePurchaseCompleted } from '@/server/analytics/purchase-events';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import { verifySignedRequest } from '@/server/security/signed-request';
import {
  deliverPaidTicketGroup,
  markMercadoPagoGroupPaid,
  updateTicketGroupStatus,
} from '@/server/services/ticketGroup';

const mercadoPagoRequestSchema = z.object({
  ticketGroupId: z.string().min(1),
});

export async function POST(request: Request) {
  const signedRequest = await verifySignedRequest(request, {
    logPrefix: '[api/mercadopago]',
  });

  if (!signedRequest.ok) {
    return signedRequest.response;
  }

  let ticketGroupId: string;
  try {
    ({ ticketGroupId } = mercadoPagoRequestSchema.parse(
      JSON.parse(signedRequest.rawBody),
    ));
  } catch {
    return NextResponse.json(
      { success: false, error: 'BAD_REQUEST', message: 'Body inválido.' },
      { status: 400 },
    );
  }

  logger.info('Payment webhook accepted', {
    operation: 'payment_webhook',
    ticketGroupId,
  });

  try {
    await fulfillTicketGroup(request.headers, ticketGroupId);
  } catch (error) {
    logger.error('Payment webhook fulfillment failed', {
      operation: 'payment_webhook',
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

async function fulfillTicketGroup(headers: Headers, ticketGroupId: string) {
  const { db, instance } = await resolveRequestContext(headers);

  // El webhook se reintenta (y un mismo pago puede avisarse varias veces): las
  // entradas se mandan sólo la primera vez que el grupo pasa a PAID.
  const transitioned = await markMercadoPagoGroupPaid(db, ticketGroupId);
  if (!transitioned) {
    logger.warn('Payment webhook for an already paid ticket group', {
      operation: 'payment_webhook',
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
    paymentMethod: 'mercado_pago',
  });

  logger.info('Payment webhook fulfillment completed', {
    operation: 'payment_webhook',
    ticketGroupId,
    eventId,
    ticketCount,
  });
}
