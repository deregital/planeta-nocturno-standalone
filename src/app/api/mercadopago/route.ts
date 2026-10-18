import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { logger } from '@/server/observability/logger';
import { verifySignedRequest } from '@/server/security/signed-request';
import {
  deliverPaidTicketGroup,
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

  await updateTicketGroupStatus(db, ticketGroupId, 'PAID');

  const { eventId, ticketCount } = await deliverPaidTicketGroup(
    db,
    instance,
    ticketGroupId,
  );

  logger.info('Payment webhook fulfillment completed', {
    operation: 'payment_webhook',
    ticketGroupId,
    eventId,
    ticketCount,
  });
}
