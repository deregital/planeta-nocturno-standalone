import { createHmac, timingSafeEqual } from 'crypto';

import { Payment } from 'mercadopago';
import { NextResponse } from 'next/server';

import { mercadoPago } from '@/server/routers/mercado-pago';
import { sendMailService } from '@/server/services/mail';
import { sendNotificationService } from '@/server/services/notification';
import { updateTicketGroupStatus } from '@/server/services/ticketGroup';
import { trpc } from '@/server/trpc/server';

function verifySignature(
  signature: string,
  request_id: string,
  data_id: string,
): boolean {
  // Parsear como pares clave=valor para no depender del orden de los campos
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const idx = part.indexOf('=');
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
    }),
  );

  const ts = parts['ts'];
  const v1 = parts['v1'];

  if (!ts || !v1) return false;

  // MP requiere que data.id sea lowercase en el manifest si contiene letras (ej: order IDs)
  const manifest = `id:${data_id.toLowerCase()};request-id:${request_id};ts:${ts};`;
  const secretKey = process.env.MP_SECRET_KEY!;
  const signatureDecrypted = createHmac('sha256', secretKey)
    .update(manifest)
    .digest('hex');
  // comparacion segura de signatures para evitar timing attacks
  const a = Buffer.from(signatureDecrypted);
  const b = Buffer.from(v1);
  const isValid = a.length === b.length && timingSafeEqual(a, b);
  return isValid;
}

export async function POST(req: Request) {
  const body: { data: { id: string } } = await req.json();
  const signature = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');

  // MP firma usando data.id del query param de la URL, no del body
  const urlDataId =
    new URL(req.url).searchParams.get('data.id') ?? body.data.id;

  if (!signature || !requestId) {
    return new NextResponse(null, { status: 400 });
  }

  const isValid = verifySignature(signature, requestId, urlDataId);

  if (!isValid) {
    // TODO: eliminar estos logs una vez resuelto el 403
    console.error('[MP webhook] Firma inválida. Inputs usados:', {
      urlDataId,
      bodyDataId: body.data.id,
      requestId,
      signatureHeader: signature,
    });
    return new NextResponse(null, { status: 403 });
  }

  const payment = await new Payment(mercadoPago).get({ id: body.data.id });

  if (!payment || !payment.external_reference) {
    return new NextResponse(null, { status: 404 });
  }

  if (payment.status === 'approved') {
    // cambiar status de ticketGroup a pagado
    if (payment.external_reference) {
      await updateTicketGroupStatus(payment.external_reference, 'PAID');
    }
    const group = await trpc.ticketGroup.getById(payment.external_reference);

    // crear pdf
    const pdfs = await trpc.ticketGroup.generatePdfsByTicketGroupId(
      payment.external_reference,
    );

    // enviar mail con los pdf de forma secuencial para evitar rate limits
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

  return new NextResponse(null, { status: 200 });
}
