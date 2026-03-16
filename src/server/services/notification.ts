import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { ticketGroup as ticketGroupSchema } from '@/drizzle/schema';
import { formatCurrency } from '@/lib/utils';
import { sendMailWithoutAttachments } from '@/server/services/mail';
import { calculateTotalPrice } from '@/server/services/ticketGroup';
import { retryWithBackoff } from '@/server/utils/retry';

export async function sendNotificationService({
  eventName,
  ticketGroupId,
  email,
}: {
  eventName: string;
  ticketGroupId: string;
  email: string;
}) {
  const ticketGroup = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroupSchema.id, ticketGroupId),
    with: {
      event: {
        with: {
          eventXorganizers: true,
        },
      },
      ticketTypePerGroups: {
        with: {
          ticketType: {
            columns: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Filter eventXorganizers by invitedById after fetching
  if (ticketGroup?.event.eventXorganizers && ticketGroup.invitedById) {
    ticketGroup.event.eventXorganizers =
      ticketGroup.event.eventXorganizers.filter(
        (eo) => eo.organizerId === ticketGroup.invitedById,
      );
  }

  const totalPrice = await calculateTotalPrice({
    ticketGroupId,
    discountPercentage:
      ticketGroup?.event.eventXorganizers[0]?.discountPercentage ?? null,
  });

  const ticketTypeText = ticketGroup?.ticketTypePerGroups
    .map(
      (ticketType) =>
        `${ticketType.amount} tickets de ${ticketType.ticketType.name}`,
    )
    .join(', ');

  const bodyText = `Se han vendido tickets para ${eventName}. ${ticketTypeText}. El monto total recaudado es de ${formatCurrency(totalPrice)}. Para más información, ingresá a la plataforma.`;

  const result = await retryWithBackoff(
    async () =>
      await sendMailWithoutAttachments({
        to: email,
        subject: `Ticket vendido - ${eventName}`,
        body: bodyText,
      }),
    3, // intentos máximos
    2000, // segundos de delay
  );

  if (result.error) {
    console.error(
      `Error al enviar notificación a ${email} para ${eventName}:`,
      result.error,
    );
  }
}
