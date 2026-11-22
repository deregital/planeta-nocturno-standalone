import type {
  PaymentContext,
  PaymentProvider,
  TransferAccountDetails,
} from '@/server/payments/types';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ticketGroup } from '@/drizzle/schema';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/server/observability/logger';
import { CHECKOUT_HOLD_TTL_MS } from '@/server/payments/constants';
import { notifyPaymentIssue } from '@/server/payments/notify';
import {
  createTaloPayment,
  getTaloPayment,
  refundTaloPayment,
  setTaloPaymentExpiration,
  TALO_REFUND_STATUSES,
  type TaloConnection,
  TaloError,
  type TaloPayment,
  taloPaymentAccount,
  taloReceivedAmount,
} from '@/server/payments/talo/client';
import {
  getTaloConnection,
  isTaloReady,
} from '@/server/payments/talo/connection';
import {
  generateTaloPaymentEmail,
  generateTaloUnderpaidEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import {
  calculateAndSaveTotalAmount,
  expiredGroupFitsQuota,
} from '@/server/services/ticketGroup';

/** El CVU de una compra acepta transferencias durante una hora. */
export const TALO_PAYMENT_TTL_MS = 60 * 60 * 1000;
/**
 * La reserva suelta el cupo cuando vence el CVU. Una transferencia que llega
 * después se entrega si todavía hay lugar; si no, se devuelve (ver
 * parseNotification).
 */
export const TALO_HOLD_TTL_MS = CHECKOUT_HOLD_TTL_MS + TALO_PAYMENT_TTL_MS;
/** La compra vencida se guarda una semana, para devolver un pago que llegue tarde. */
export const TALO_UNPAID_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const notificationSchema = z
  .object({
    paymentId: z.string().min(1).optional(),
    payment_id: z.string().min(1).optional(),
  })
  .transform((body) => body.paymentId ?? body.payment_id)
  .pipe(z.string().min(1));

/**
 * - `UNDERPAID`: transfirió menos que el precio (más allá de la tolerancia de Talo).
 * - `OVERPAID`: transfirió de más; las entradas se entregaron.
 * - `LATE`: transfirió con la reserva vencida y no había lugar (o faltaba
 *   plata); se devuelve.
 */
export const TALO_ISSUES = ['UNDERPAID', 'OVERPAID', 'LATE'] as const;
export type TaloIssue = (typeof TALO_ISSUES)[number];

const refundStateSchema = z.object({
  type: z.enum(['FULL', 'PARTIAL']),
  amount: z.number(),
  status: z.enum(TALO_REFUND_STATUSES),
  requestedAt: z.string(),
});
export type TaloRefundState = z.infer<typeof refundStateSchema>;

const detailsSchema = z.object({
  cvu: z.string().min(1),
  alias: z.string().nullable(),
  amount: z.number(),
  expiresAt: z.string().nullable(),
  /** Lo que transfirió el comprador en total, según el último aviso. */
  received: z.number().optional(),
  issue: z.enum(TALO_ISSUES).nullish(),
  /** Casos que ya se le avisaron al contacto (para no repetir el mail). */
  notified: z.array(z.enum(TALO_ISSUES)).optional(),
  refund: refundStateSchema.nullish(),
  /** El organizador aceptó lo transferido aunque no alcanzaba el precio. */
  accepted: z.boolean().optional(),
});

/** Lo guardado en la compra: los datos para pagar y cómo viene el pago. */
export type TaloPaymentDetails = z.infer<typeof detailsSchema>;

/** Los datos de Talo guardados en la compra, o null si no hay. */
export function readTaloDetails(value: unknown): TaloPaymentDetails | null {
  const parsed = detailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function saveTaloDetails(
  ctx: PaymentContext,
  ticketGroupId: string,
  details: TaloPaymentDetails,
) {
  await ctx.db
    .update(ticketGroup)
    .set({ paymentDetails: details })
    .where(eq(ticketGroup.id, ticketGroupId));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function accountOf(details: TaloPaymentDetails): TransferAccountDetails {
  return {
    cvu: details.cvu,
    alias: details.alias,
    amount: details.amount,
    expiresAt: details.expiresAt,
  };
}

/**
 * Pide a Talo que devuelva plata de un pago. Devuelve el estado de la
 * devolución, o null si Talo no la aceptó (queda en el log).
 */
export async function requestTaloRefund(
  connection: TaloConnection,
  paymentId: string,
  refund: { type: 'FULL' | 'PARTIAL'; amount: number },
): Promise<TaloRefundState | null> {
  try {
    const created = await refundTaloPayment(
      connection,
      paymentId,
      refund.type === 'FULL'
        ? { type: 'FULL' }
        : { type: 'PARTIAL', amount: refund.amount },
    );
    return {
      type: refund.type,
      amount: created?.amount ?? refund.amount,
      status: created?.refund_status ?? 'PENDING',
      requestedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Talo refund failed', {
      operation: 'payment_refund',
      paymentId,
      refund,
      error,
    });
    return null;
  }
}

async function createPayment(
  ctx: PaymentContext,
  group: {
    id: string;
    createdAt: string;
    eventName: string;
    buyer?: { name: string; mail: string; dni: string };
  },
  amount: number,
) {
  const connection = await getTaloConnection(ctx.db);
  if (!connection) throw new Error('Talo no está configurado');

  const pageUrl = `${ctx.instance.publicUrl}/tickets/${group.id}`;
  const create = (externalId: string) =>
    createTaloPayment(connection, {
      amount,
      externalId,
      webhookUrl: `${ctx.instance.publicUrl}/api/payments/talo`,
      redirectUrl: pageUrl,
      motive: `Entradas para ${group.eventName}`,
      client: group.buyer && {
        first_name: group.buyer.name,
        email: group.buyer.mail,
        dni: group.buyer.dni,
      },
    });

  // Talo devuelve el pago existente si se repite el external_id: si ese ya
  // venció o se pagó con otro monto, se pide uno nuevo.
  let payment: TaloPayment = await create(group.id);
  if (
    payment.payment_status !== 'PENDING' ||
    taloPaymentAccount(payment).amount !== amount
  ) {
    payment = await create(`${group.id}.${Date.now()}`);
  }

  // El CVU nunca dura más que la reserva: pasar a Talo media hora después de
  // reservar deja menos de una hora, y una transferencia a tiempo no se
  // devuelve como tardía.
  const expiresAt = new Date(
    Math.min(
      Date.now() + TALO_PAYMENT_TTL_MS,
      new Date(group.createdAt).getTime() + TALO_HOLD_TTL_MS,
    ),
  );
  try {
    await setTaloPaymentExpiration(connection, payment.id, expiresAt);
  } catch (error) {
    // Sin acortar, el CVU sigue aceptando pagos días después: si llegan con
    // la reserva vencida, se devuelven.
    logger.warn('Talo payment expiration not updated', {
      ticketGroupId: group.id,
      paymentId: payment.id,
      error,
    });
  }

  const account = taloPaymentAccount(payment);
  if (!account.cvu) {
    throw new Error('Talo no devolvió un CVU para el pago');
  }
  return {
    paymentId: payment.id,
    details: {
      cvu: account.cvu,
      alias: account.alias,
      amount,
      expiresAt: expiresAt.toISOString(),
    } satisfies TaloPaymentDetails,
  };
}

/** Un pago que llegó sin compra que lo espere: se devuelve entero. */
async function refundUnknownPayment(
  ctx: PaymentContext,
  connection: TaloConnection,
  payment: TaloPayment,
) {
  const received = taloReceivedAmount(payment);
  if (received <= 0) return;
  // Si ya se pidió (Talo reintenta el aviso), no se pide de nuevo.
  if (payment.refunds?.some((r) => r.refund_status !== 'FAILED')) return;
  const refund = await requestTaloRefund(connection, payment.id, {
    type: 'FULL',
    amount: received,
  });
  await notifyPaymentIssue(ctx, refund ? 'UNKNOWN_PURCHASE' : 'REFUND_FAILED', {
    ticketGroupId: null,
    received,
  });
}

export const taloProvider: PaymentProvider = {
  method: 'TALO',
  label: 'Talo',
  buyerLabel: 'Transferencia inmediata',
  buyerDescription:
    'Te damos un CVU para transferir desde tu banco o billetera. Las entradas te llegan solas apenas se acredita.',
  analyticsName: 'talo',
  confirmation: 'webhook',
  hold: {
    releaseAfterMs: TALO_HOLD_TTL_MS,
    deleteAfterMs: TALO_UNPAID_RETENTION_MS,
  },
  isConfigured: async ({ db }) => isTaloReady(db),
  start: async (ctx, ticketGroupId) => {
    const group = await ctx.db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.id, ticketGroupId),
      columns: {
        id: true,
        status: true,
        paymentMethod: true,
        paymentReference: true,
        paymentDetails: true,
        createdAt: true,
      },
      with: {
        event: { columns: { name: true } },
        ticketTypePerGroups: { columns: { amount: true }, limit: 1 },
        emittedTickets: {
          columns: { fullName: true, mail: true, dni: true },
          limit: 1,
        },
      },
    });
    if (
      !group ||
      group.status !== 'BOOKED' ||
      group.ticketTypePerGroups.length === 0
    ) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'ticketGroup no encontrado',
      });
    }

    const amount = await calculateAndSaveTotalAmount(ctx.db, ticketGroupId);

    // Volver a elegir Talo con el CVU vigente muestra el mismo.
    const current = readTaloDetails(group.paymentDetails);
    if (
      group.paymentReference &&
      current &&
      current.amount === amount &&
      current.expiresAt &&
      new Date(current.expiresAt).getTime() > Date.now() + 5 * 60 * 1000
    ) {
      await ctx.db
        .update(ticketGroup)
        .set({ paymentMethod: 'TALO' })
        .where(eq(ticketGroup.id, ticketGroupId));
      return { type: 'instructions', ...accountOf(current) };
    }

    const buyer = group.emittedTickets[0];
    const { paymentId, details } = await createPayment(
      ctx,
      {
        id: group.id,
        createdAt: group.createdAt,
        eventName: group.event.name,
        buyer: buyer && {
          name: buyer.fullName,
          mail: buyer.mail,
          dni: buyer.dni,
        },
      },
      amount,
    );

    await ctx.db
      .update(ticketGroup)
      .set({
        paymentMethod: 'TALO',
        paymentReference: paymentId,
        paymentDetails: details,
      })
      .where(eq(ticketGroup.id, ticketGroupId));

    if (buyer?.mail) {
      const mail = await sendMailWithoutAttachments(ctx.instance, {
        to: buyer.mail,
        subject: `Completá el pago de tus entradas para ${group.event.name}`,
        html: generateTaloPaymentEmail(ctx.instance, {
          eventName: group.event.name,
          totalAmount: formatCurrency(amount),
          cvu: details.cvu,
          alias: details.alias,
          expiresAt: details.expiresAt ? formatTime(details.expiresAt) : null,
          paymentPageUrl: `${ctx.instance.publicUrl}/tickets/${group.id}`,
        }),
      }).catch((error: unknown) => ({ error }));
      if (mail.error) {
        logger.error('Talo payment email failed', {
          ticketGroupId,
          error: mail.error,
        });
      }
    }

    return { type: 'instructions', ...details };
  },
  // El aviso de Talo no viene firmado: sólo se toma el id y se consulta el
  // pago en Talo con las credenciales de la plataforma.
  parseNotification: async (request, ctx) => {
    let paymentId: string;
    try {
      paymentId = notificationSchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { success: false, error: 'BAD_REQUEST', message: 'Body inválido.' },
        { status: 400 },
      );
    }

    const connection = await getTaloConnection(ctx.db);
    if (!connection) {
      return NextResponse.json({ error: 'NOT_CONFIGURED' }, { status: 404 });
    }
    let payment: TaloPayment;
    try {
      payment = await getTaloPayment(connection, paymentId);
    } catch (error) {
      // Un id que Talo no conoce para esta cuenta: no hay nada que verificar.
      if (error instanceof TaloError && error.status === 404) {
        logger.warn('Talo webhook for a payment Talo does not know', {
          operation: 'payment_webhook',
          paymentId,
        });
        return new NextResponse(null, { status: 200 });
      }
      throw error;
    }

    const status = payment.payment_status;
    const received = taloReceivedAmount(payment);
    const log = { operation: 'payment_webhook', paymentId: payment.id };

    const group = await ctx.db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.paymentReference, payment.id),
      columns: { id: true, status: true, paymentDetails: true },
      with: {
        event: { columns: { name: true } },
        ticketTypePerGroups: { columns: { amount: true }, limit: 1 },
        emittedTickets: { columns: { mail: true }, limit: 1 },
      },
    });
    if (!group) {
      // Un pago sin compra: se borró (pasó una semana) o es de un CVU viejo.
      logger.warn('Talo webhook for an unknown payment', {
        ...log,
        externalId: payment.external_id,
        status,
        received,
      });
      if (status !== 'PENDING' && status !== 'EXPIRED') {
        await refundUnknownPayment(ctx, connection, payment);
      }
      return new NextResponse(null, { status: 200 });
    }

    const ticketGroupId = group.id;
    if (status === 'PENDING' || status === 'EXPIRED') {
      return { ticketGroupId, status: 'IGNORE' };
    }

    const details = readTaloDetails(group.paymentDetails);
    if (!details) {
      logger.error('Talo payment without stored details', {
        ...log,
        ticketGroupId,
      });
      return {
        ticketGroupId,
        status: status === 'UNDERPAID' ? 'IGNORE' : 'PAID',
      };
    }
    const notifyOnce = async (issue: TaloIssue, next: TaloPaymentDetails) => {
      if (details.notified?.includes(issue)) return next;
      await notifyPaymentIssue(ctx, issue, { ticketGroupId, received });
      return { ...next, notified: [...(next.notified ?? []), issue] };
    };

    // Ya entregada: sólo importa si después transfirió de más.
    if (group.status !== 'BOOKED') {
      if (status === 'OVERPAID' && details.issue !== 'OVERPAID') {
        const next = await notifyOnce('OVERPAID', {
          ...details,
          received,
          issue: 'OVERPAID',
        });
        await saveTaloDetails(ctx, ticketGroupId, next);
      }
      return { ticketGroupId, status: 'PAID' };
    }

    // La reserva ya soltó el cupo (venció el CVU, o la productora asignó a
    // mano en Talo una transferencia retenida). Si el pago está completo y las
    // entradas todavía entran en el cupo, se entregan igual; si no, se
    // devuelve. Un pago que aceptó el organizador se entrega siempre.
    const quotaReleased =
      group.ticketTypePerGroups.length === 0 && !details.accepted;
    const alreadyRefunded =
      details.refund !== undefined &&
      details.refund !== null &&
      details.refund.status !== 'FAILED';
    const deliverLate =
      quotaReleased &&
      !alreadyRefunded &&
      status !== 'UNDERPAID' &&
      (await expiredGroupFitsQuota(ctx.db, ticketGroupId));
    if (deliverLate) {
      logger.info('Talo late payment delivered: tickets still available', {
        ...log,
        ticketGroupId,
        received,
      });
    }
    if (quotaReleased && !deliverLate) {
      if (alreadyRefunded) {
        return { ticketGroupId, status: 'IGNORE' };
      }
      const refund = await requestTaloRefund(connection, payment.id, {
        type: 'FULL',
        amount: received,
      });
      let next: TaloPaymentDetails = {
        ...details,
        received,
        issue: 'LATE',
        refund,
      };
      if (refund) {
        next = await notifyOnce('LATE', next);
      } else {
        await notifyPaymentIssue(ctx, 'REFUND_FAILED', {
          ticketGroupId,
          received,
        });
      }
      await saveTaloDetails(ctx, ticketGroupId, next);
      logger.warn('Talo payment after the reservation expired', {
        ...log,
        ticketGroupId,
        received,
        refunded: Boolean(refund),
      });
      return { ticketGroupId, status: 'IGNORE' };
    }

    if (status === 'UNDERPAID') {
      const previous = details.received ?? 0;
      let next: TaloPaymentDetails = {
        ...details,
        received,
        issue: 'UNDERPAID',
      };
      // El comprador se entera de cuánto falta cada vez que transfiere.
      const buyerMail = group.emittedTickets[0]?.mail;
      if (received > previous && buyerMail) {
        const mail = await sendMailWithoutAttachments(ctx.instance, {
          to: buyerMail,
          subject: `Te falta completar el pago de ${group.event.name}`,
          html: generateTaloUnderpaidEmail({
            eventName: group.event.name,
            received: formatCurrency(received),
            missing: formatCurrency(details.amount - received),
            cvu: details.cvu,
            expiresAt: details.expiresAt ? formatTime(details.expiresAt) : null,
            paymentPageUrl: `${ctx.instance.publicUrl}/tickets/${ticketGroupId}`,
          }),
        }).catch((error: unknown) => ({ error }));
        if (mail.error) {
          logger.error('Talo underpaid email failed', {
            ticketGroupId,
            error: mail.error,
          });
        }
      }
      next = await notifyOnce('UNDERPAID', next);
      await saveTaloDetails(ctx, ticketGroupId, next);
      logger.warn('Talo payment underpaid', {
        ...log,
        ticketGroupId,
        received,
      });
      return { ticketGroupId, status: 'IGNORE' };
    }

    let next: TaloPaymentDetails = {
      ...details,
      received,
      issue: status === 'OVERPAID' ? 'OVERPAID' : null,
    };
    if (status === 'OVERPAID') next = await notifyOnce('OVERPAID', next);
    await saveTaloDetails(ctx, ticketGroupId, next);
    return { ticketGroupId, status: 'PAID' };
  },
};
