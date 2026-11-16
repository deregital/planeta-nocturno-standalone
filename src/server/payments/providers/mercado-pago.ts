import type { PaymentContext, PaymentProvider } from '@/server/payments/types';

import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ticketGroup } from '@/drizzle/schema';
import { CHECKOUT_HOLD_TTL_MS } from '@/server/payments/constants';
import { verifySignedRequest } from '@/server/security/signed-request';
import { assertTicketGroupEventNotBlocked } from '@/server/services/eventBlock';
import { calculateAndSaveTotalAmount } from '@/server/services/ticketGroup';

/** La preferencia de Mercado Pago deja de aceptar pagos a los 20 minutos de creada. */
export const MERCADO_PAGO_PREFERENCE_TTL_MS = 20 * 60 * 1000;
/**
 * Una reserva que pasó a Mercado Pago retiene el cupo hasta que su preferencia
 * venció, con margen para que llegue el aviso de pago.
 */
export const MERCADO_PAGO_HOLD_TTL_MS =
  CHECKOUT_HOLD_TTL_MS + MERCADO_PAGO_PREFERENCE_TTL_MS + 10 * 60 * 1000;
/**
 * Las entradas de una compra de Mercado Pago sin aprobar se guardan una semana:
 * un pago en revisión o en efectivo puede acreditarse días después.
 */
export const MERCADO_PAGO_UNPAID_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const notificationSchema = z.object({ ticketGroupId: z.string().min(1) });

/** Crea la preferencia de una reserva vigente y devuelve el link de pago. */
export async function createMercadoPagoPreference(
  { db, instance }: PaymentContext,
  ticketGroupId: string,
) {
  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    columns: { id: true, status: true },
    with: {
      ticketTypePerGroups: { columns: { amount: true } },
      event: { columns: { name: true, description: true } },
    },
  });

  // Bloqueado después de reservar: la reserva sin pago no se completa.
  await assertTicketGroupEventNotBlocked(db, ticketGroupId);

  // Sin reserva vigente (venció y soltó el cupo, o ya se pagó) no se cobra.
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

  if (!instance.mercadoPagoAccessToken) {
    throw new Error('Mercado Pago no está configurado');
  }

  const mercadoPago = new MercadoPagoConfig({
    accessToken: instance.mercadoPagoAccessToken,
  });

  const totalPrice = await calculateAndSaveTotalAmount(db, ticketGroupId);

  await db
    .update(ticketGroup)
    .set({ paymentMethod: 'MERCADO_PAGO' })
    .where(eq(ticketGroup.id, ticketGroupId));

  const preference = await new Preference(mercadoPago).create({
    body: {
      items: [
        {
          id: group.id,
          title: group.event.name,
          description: group.event.description,
          quantity: 1,
          unit_price: totalPrice,
        },
      ],
      external_reference: group.id,
      auto_return: 'approved',
      // Sin vencimiento la preferencia se podía pagar después de que la
      // reserva soltó el cupo. Pasado este plazo Mercado Pago no la cobra.
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(
        Date.now() + MERCADO_PAGO_PREFERENCE_TTL_MS,
      ).toISOString(),
      // Todas vuelven a la página de la compra, que según el estado ofrece
      // esperar el aviso o volver a pagar.
      back_urls: {
        success: `${instance.publicUrl}/tickets/${group.id}`,
        pending: `${instance.publicUrl}/tickets/${group.id}`,
        failure: `${instance.publicUrl}/tickets/${group.id}`,
      },
      metadata: {
        ticket_group_id: group.id,
        instance_url: instance.publicUrl,
      },
    },
  });
  return preference.init_point!;
}

export const mercadoPagoProvider: PaymentProvider = {
  method: 'MERCADO_PAGO',
  label: 'Mercado Pago',
  analyticsName: 'mercado_pago',
  confirmation: 'webhook',
  hold: {
    releaseAfterMs: MERCADO_PAGO_HOLD_TTL_MS,
    deleteAfterMs: MERCADO_PAGO_UNPAID_RETENTION_MS,
  },
  isReady: async ({ instance }) => Boolean(instance.mercadoPagoAccessToken),
  start: async (ctx, ticketGroupId) => ({
    type: 'redirect',
    url: await createMercadoPagoPreference(ctx, ticketGroupId),
  }),
  // El aviso de Mercado Pago llega reenviado y firmado por el servicio que
  // recibe sus notificaciones: sólo trae el grupo ya aprobado.
  parseNotification: async (request) => {
    const signedRequest = await verifySignedRequest(request, {
      logPrefix: '[api/mercadopago]',
    });
    if (!signedRequest.ok) return signedRequest.response;

    try {
      const { ticketGroupId } = notificationSchema.parse(
        JSON.parse(signedRequest.rawBody),
      );
      return { ticketGroupId, status: 'PAID' };
    } catch {
      return NextResponse.json(
        { success: false, error: 'BAD_REQUEST', message: 'Body inválido.' },
        { status: 400 },
      );
    }
  },
};
