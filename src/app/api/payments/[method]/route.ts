import { NextResponse } from 'next/server';

import { PAYMENT_WEBHOOK_SLUGS } from '@/server/payments/registry';
import { handlePaymentNotification } from '@/server/payments/webhook';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ method: string }> },
) {
  const { method } = await params;
  const provider = Object.hasOwn(PAYMENT_WEBHOOK_SLUGS, method)
    ? PAYMENT_WEBHOOK_SLUGS[method]
    : undefined;
  if (!provider) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }
  return handlePaymentNotification(request, provider);
}
