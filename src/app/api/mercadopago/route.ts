import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifySignedRequest } from '@/server/security/signed-request';
import { resolveRequestContext } from '@/server/instance/resolve-request-context';
import { sendMailService } from '@/server/services/mail';
import { sendNotificationService } from '@/server/services/notification';
import { updateTicketGroupStatus } from '@/server/services/ticketGroup';
import { trpc } from '@/server/trpc/server';

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

  const { db, instance } = await resolveRequestContext(request.headers);

  // cambiar status de ticketGroup a pagado
  await updateTicketGroupStatus(db, ticketGroupId, 'PAID');

  const group = await trpc.ticketGroup.getById(ticketGroupId);

  // crear pdf
  const pdfs =
    await trpc.ticketGroup.generatePdfsByTicketGroupId(ticketGroupId);

  // enviar mail con los pdf de forma secuencial para evitar rate limits
  for (const pdf of pdfs) {
    await sendMailService(instance, {
      eventName: group.event.name,
      receiver: pdf.ticket.mail,
      subject: `¡Llegaron tus tickets para ${group.event.name}!`,
      body: `Te esperamos.`,
      attatchments: [pdf.pdf.blob],
    });
  }

  if (group.event.emailNotification) {
    await sendNotificationService(db, instance, {
      eventName: group.event.name,
      ticketGroupId: group.id,
      email: group.event.emailNotification,
    });
  }

  return new NextResponse(null, { status: 200 });
}
