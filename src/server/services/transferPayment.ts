import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/server/observability/logger';
import {
  generateTransferPaymentEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import { calculateAndSaveTotalAmount } from '@/server/services/ticketGroup';

/**
 * Deja la compra pendiente de transferencia al alias de la plataforma y le
 * manda al comprador las instrucciones de pago.
 */
export async function startTransferPayment(
  db: Db,
  instance: ResolvedInstance,
  {
    ticketGroupId,
    transferAlias,
  }: { ticketGroupId: string; transferAlias: string },
) {
  const totalAmount = await calculateAndSaveTotalAmount(db, ticketGroupId);

  await db
    .update(ticketGroup)
    .set({ paymentMethod: 'TRANSFER' })
    .where(eq(ticketGroup.id, ticketGroupId));

  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    columns: { id: true },
    with: {
      event: { columns: { name: true } },
      emittedTickets: { columns: { mail: true, fullName: true }, limit: 1 },
    },
  });

  const buyerEmail = group?.emittedTickets[0]?.mail;
  if (!group || !buyerEmail) {
    throw new Error('ticketGroup sin tickets emitidos');
  }

  const mail = await sendMailWithoutAttachments(instance, {
    to: buyerEmail,
    subject: `Completá el pago de tus entradas para ${group.event.name}`,
    html: generateTransferPaymentEmail(instance, {
      eventName: group.event.name,
      totalAmount: formatCurrency(totalAmount),
      transferAlias,
      buyerName: group.emittedTickets[0]?.fullName ?? '',
    }),
  }).catch((error: unknown) => ({ error }));
  if (mail.error) {
    logger.error('Transfer payment email failed', {
      ticketGroupId,
      error: mail.error,
    });
  }
}
