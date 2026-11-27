import type { PaymentContext } from '@/server/payments/types';

import { eq } from 'drizzle-orm';

import { ticketGroup } from '@/drizzle/schema';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/server/observability/logger';
import {
  generatePaymentIssueEmail,
  type PaymentIssueKind,
  paymentIssueSubject,
  sendMailWithoutAttachments,
} from '@/server/services/mail';

/**
 * Le avisa al contacto de la plataforma (quien habilitó los medios de pago)
 * que un pago necesita su atención. Sin contacto cargado, queda en el log.
 */
export async function notifyPaymentIssue(
  ctx: PaymentContext,
  kind: PaymentIssueKind,
  {
    ticketGroupId,
    received,
  }: { ticketGroupId: string | null; received?: number | null },
) {
  const group = ticketGroupId
    ? await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, ticketGroupId),
        columns: { totalAmount: true },
        with: {
          event: { columns: { name: true, slug: true } },
          emittedTickets: { columns: { fullName: true, mail: true }, limit: 1 },
        },
      })
    : undefined;
  const buyer = group?.emittedTickets[0];
  const log = { operation: 'payment_issue', kind, ticketGroupId, received };

  const to = ctx.instance.contactEmail;
  if (!to) {
    logger.warn('Payment issue without a platform contact email', log);
    return;
  }

  const mail = await sendMailWithoutAttachments(ctx.instance, {
    to,
    subject: paymentIssueSubject(kind),
    html: generatePaymentIssueEmail({
      kind,
      eventName: group?.event.name ?? null,
      buyer: buyer ? `${buyer.fullName} (${buyer.mail})` : null,
      expected: group ? formatCurrency(Number(group.totalAmount)) : null,
      received:
        received === null || received === undefined
          ? null
          : formatCurrency(received),
      purchasesUrl: group
        ? `${ctx.instance.publicUrl}/admin/event/${group.event.slug}#purchases`
        : null,
    }),
  }).catch((error: unknown) => ({ error }));

  if (mail.error) {
    logger.error('Payment issue email failed', { ...log, error: mail.error });
  } else {
    logger.info('Payment issue notified', log);
  }
}
