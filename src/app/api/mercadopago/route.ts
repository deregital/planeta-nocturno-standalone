import { NextResponse } from 'next/server';

import {
  handleMercadoPagoWebhookNotification,
  verifyMercadoPagoWebhookSignature,
} from '@/server/services/mercadoPagoWebhook';

export async function POST(req: Request) {
  const body: { data: { id: string } } = await req.json();
  const signature = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');
  const paymentId = body.data.id;

  if (!signature || !requestId || !paymentId) {
    return new NextResponse(null, { status: 400 });
  }

  const isValid = verifyMercadoPagoWebhookSignature(
    signature,
    requestId,
    paymentId,
  );

  if (!isValid) {
    return new NextResponse(null, { status: 403 });
  }

  const result = await handleMercadoPagoWebhookNotification(paymentId);

  if (result.reason === 'not_found') {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(null, { status: 200 });
}
