import { createHmac, timingSafeEqual } from 'crypto';

import { Payment } from 'mercadopago';

import { mercadoPago } from '@/server/routers/mercado-pago';
import { sendMailService } from '@/server/services/mail';
import { sendNotificationService } from '@/server/services/notification';
import { updateTicketGroupStatus } from '@/server/services/ticketGroup';
import { trpc } from '@/server/trpc/server';

const E2E_MOCK_PAYMENT_PREFIX = 'e2e-';

export type MercadoPagoPaymentSnapshot = {
  status?: string;
  external_reference?: string;
};

export function isE2eMockMercadoPagoWebhookEnabled() {
  return process.env.E2E_MOCK_MP_WEBHOOK === 'true';
}

export function buildE2eMockPaymentId(ticketGroupId: string) {
  return `${E2E_MOCK_PAYMENT_PREFIX}${ticketGroupId}`;
}

function resolveE2eMockPayment(
  paymentId: string,
): MercadoPagoPaymentSnapshot | null {
  if (
    !isE2eMockMercadoPagoWebhookEnabled() ||
    !paymentId.startsWith(E2E_MOCK_PAYMENT_PREFIX)
  ) {
    return null;
  }

  const ticketGroupId = paymentId.slice(E2E_MOCK_PAYMENT_PREFIX.length);
  if (!ticketGroupId) {
    return null;
  }

  return {
    status: 'approved',
    external_reference: ticketGroupId,
  };
}

export function verifyMercadoPagoWebhookSignature(
  signature: string,
  requestId: string,
  paymentId: string,
) {
  const secretKey = process.env.MP_SECRET_KEY?.trim();
  if (!secretKey) {
    return false;
  }

  const ts = signature.split(',')[0]?.split('=')[1];
  const v1 = signature.split(',')[1]?.split('=')[1];
  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts?.trim()};`;
  const signatureDecrypted = createHmac('sha256', secretKey)
    .update(manifest)
    .digest('hex');
  const a = Buffer.from(signatureDecrypted);
  const b = Buffer.from(v1?.trim() ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function fetchMercadoPagoPayment(paymentId: string) {
  const mockPayment = resolveE2eMockPayment(paymentId);
  if (mockPayment) {
    return mockPayment;
  }

  return new Payment(mercadoPago).get({ id: paymentId });
}

export async function processApprovedMercadoPagoPayment(
  externalReference: string,
  options?: { skipSideEffects?: boolean },
) {
  await updateTicketGroupStatus(externalReference, 'PAID');

  if (options?.skipSideEffects) {
    await trpc.ticketGroup.generatePdfsByTicketGroupId(externalReference);
    return;
  }

  const group = await trpc.ticketGroup.getById(externalReference);
  const pdfs =
    await trpc.ticketGroup.generatePdfsByTicketGroupId(externalReference);

  if (!group.event.extraTicketData) {
    await sendMailService({
      eventName: group.event.name,
      receiver: pdfs[0].ticket.mail,
      subject: `¡Llegaron tus tickets para ${group.event.name}!`,
      body: `Te esperamos.`,
      attatchments: pdfs.map((pdf) => pdf.pdf.blob),
    });
  } else {
    for (const pdf of pdfs) {
      await sendMailService({
        eventName: group.event.name,
        receiver: pdf.ticket.mail,
        subject: `¡Llegaron tus tickets para ${group.event.name}!`,
        body: `Te esperamos.`,
        attatchments: [pdf.pdf.blob],
      });
    }
  }

  if (group.event.emailNotification) {
    await sendNotificationService({
      eventName: group.event.name,
      ticketGroupId: group.id,
      email: group.event.emailNotification,
    });
  }
}

export async function handleMercadoPagoWebhookNotification(paymentId: string) {
  const payment = await fetchMercadoPagoPayment(paymentId);

  if (!payment?.external_reference) {
    return { processed: false as const, reason: 'not_found' as const };
  }

  if (payment.status !== 'approved') {
    return {
      processed: false as const,
      reason: 'not_approved' as const,
      status: payment.status,
    };
  }

  await processApprovedMercadoPagoPayment(payment.external_reference, {
    skipSideEffects:
      isE2eMockMercadoPagoWebhookEnabled() &&
      paymentId.startsWith(E2E_MOCK_PAYMENT_PREFIX),
  });

  return {
    processed: true as const,
    externalReference: payment.external_reference,
  };
}
