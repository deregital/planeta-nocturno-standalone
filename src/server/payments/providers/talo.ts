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
import {
  createTaloPayment,
  getTaloPayment,
  setTaloPaymentExpiration,
  TaloError,
  type TaloPayment,
  taloPaymentAccount,
} from '@/server/payments/talo/client';
import {
  getTaloConnection,
  isTaloReady,
} from '@/server/payments/talo/connection';
import {
  generateTaloPaymentEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import { calculateAndSaveTotalAmount } from '@/server/services/ticketGroup';

/** El CVU de una compra acepta transferencias durante una hora. */
export const TALO_PAYMENT_TTL_MS = 60 * 60 * 1000;
/**
 * La reserva retiene el cupo hasta que vence el CVU, con margen para que
 * llegue el aviso de una transferencia hecha a último momento.
 */
export const TALO_HOLD_TTL_MS =
  CHECKOUT_HOLD_TTL_MS + TALO_PAYMENT_TTL_MS + 10 * 60 * 1000;
/** Como en Mercado Pago, una transferencia tardía se honra durante una semana. */
export const TALO_UNPAID_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const notificationSchema = z
  .object({
    paymentId: z.string().min(1).optional(),
    payment_id: z.string().min(1).optional(),
  })
  .transform((body) => body.paymentId ?? body.payment_id)
  .pipe(z.string().min(1));

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Los datos para pagar guardados en la compra, si siguen sirviendo. */
export function readTaloDetails(value: unknown): TransferAccountDetails | null {
  const parsed = z
    .object({
      cvu: z.string().min(1),
      alias: z.string().nullable(),
      amount: z.number(),
      expiresAt: z.string().nullable(),
    })
    .safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function createPayment(
  ctx: PaymentContext,
  group: {
    id: string;
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

  const expiresAt = new Date(Date.now() + TALO_PAYMENT_TTL_MS);
  try {
    await setTaloPaymentExpiration(connection, payment.id, expiresAt);
  } catch (error) {
    // Sin acortar, el CVU sigue aceptando pagos días después: la reserva ya
    // soltó el cupo pero el pago tardío se honra igual (markGroupPaid).
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
    } satisfies TransferAccountDetails,
  };
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
      return { type: 'instructions', ...current };
    }

    const buyer = group.emittedTickets[0];
    const { paymentId, details } = await createPayment(
      ctx,
      {
        id: group.id,
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

    const group = await ctx.db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.paymentReference, payment.id),
      columns: { id: true, totalAmount: true },
    });
    if (!group) {
      // Un pago de otra compra (o de antes de cambiar de CVU): no hay nada
      // que entregar. 200 para que Talo no reintente.
      logger.warn('Talo webhook for an unknown payment', {
        operation: 'payment_webhook',
        paymentId: payment.id,
        externalId: payment.external_id,
      });
      return new NextResponse(null, { status: 200 });
    }

    if (payment.payment_status === 'UNDERPAID') {
      logger.warn('Talo payment underpaid', {
        operation: 'payment_webhook',
        ticketGroupId: group.id,
        paymentId: payment.id,
      });
      return { ticketGroupId: group.id, status: 'IGNORE' };
    }
    if (
      payment.payment_status === 'SUCCESS' ||
      payment.payment_status === 'OVERPAID'
    ) {
      return { ticketGroupId: group.id, status: 'PAID' };
    }
    return { ticketGroupId: group.id, status: 'IGNORE' };
  },
};
