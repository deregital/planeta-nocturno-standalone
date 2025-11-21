import { createHmac } from 'crypto';

import { Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

import { checkFeature } from '@/components/admin/config/checkFeature';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';
import { mercadoPago } from '@/server/routers/mercado-pago';
import { trpc } from '@/server/trpc/server';

function verifySignature(
  signature: string,
  request_id: string,
  data_id: string,
): boolean {
  const ts = signature.split(',')[0]?.split('=')[1];
  const v1 = signature.split(',')[1]?.split('=')[1];
  const manifest = `id:${data_id};request-id:${request_id};ts:${ts?.trim()};`;
  const secretKey = process.env.MP_SECRET_KEY!;
  const signatureDecrypted = createHmac('sha256', secretKey)
    .update(manifest)
    .digest('hex');
  const isValid = signatureDecrypted === v1?.trim();

  return isValid;
}

export async function POST(req: Request) {
  const body: { data: { id: string } } = await req.json();
  const signature = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');

  if (!signature || !requestId) {
    return new NextResponse(null, { status: 400 });
  }

  const isValid = verifySignature(signature, requestId, body.data.id);

  if (!isValid) {
    return new NextResponse(null, { status: 403 });
  }

  const payment = await new Payment(mercadoPago).get({ id: body.data.id });

  if (!payment || !payment.external_reference) {
    return new NextResponse(null, { status: 404 });
  }

  if (payment.status === 'approved') {
    // cambiar status de ticketGroup a pagado
    if (payment.external_reference) {
      await trpc.ticketGroup.updateStatus({
        id: payment.external_reference,
        status: 'PAID',
      });
    }
    const group = await trpc.ticketGroup.getById(payment.external_reference);

    // crear pdf
    const pdfs = await trpc.ticketGroup.generatePdfsByTicketGroupId(
      payment.external_reference,
    );

    // enviar mail con los pdf de forma secuencial para evitar rate limits
    if (!group.event.extraTicketData) {
      await trpc.mail.send({
        eventName: group.event.name,
        receiver: pdfs[0].ticket.mail,
        subject: `¡Llegaron tus tickets para ${group.event.name}!`,
        body: `Te esperamos.`,
        attatchments: pdfs.map((pdf) => pdf.pdf.blob),
      });
    } else {
      for (const pdf of pdfs) {
        await trpc.mail.send({
          eventName: group.event.name,
          receiver: pdf.ticket.mail,
          subject: `¡Llegaron tus tickets para ${group.event.name}!`,
          body: `Te esperamos.`,
          attatchments: [pdf.pdf.blob],
        });
      }
    }

    await checkFeature(FEATURE_KEYS.EMAIL_NOTIFICATION, async () => {
      await trpc.mail.sendNotification({
        eventName: group.event.name,
        ticketGroupId: group.id,
      });
    });
  }

  return new NextResponse(null, { status: 200 });
}
