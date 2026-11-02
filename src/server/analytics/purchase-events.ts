import 'server-only';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { eq } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';
import { instanceAnalyticsKey } from '@/lib/analytics/instance-context';
import {
  logger,
  POSTHOG_DISTINCT_ID_HEADER,
  POSTHOG_SESSION_HEADER,
} from '@/server/observability/logger';
import { getPostHogServer } from '@/server/observability/posthog-server';

export type PurchasePaymentMethod = 'free' | 'mercado_pago' | 'transfer';

type Buyer = { distinctId?: string; sessionId?: string };

/** Comprador según los headers que posthog-js agrega a los fetch del checkout. */
export function buyerFromHeaders(headers: Headers): Buyer {
  return {
    distinctId: headers.get(POSTHOG_DISTINCT_ID_HEADER) ?? undefined,
    sessionId: headers.get(POSTHOG_SESSION_HEADER) ?? undefined,
  };
}

/**
 * `purchase_completed`: una compra del checkout quedó confirmada (gratis,
 * Mercado Pago o transferencia liberada). Los llamadores lo mandan una sola vez
 * por ticketGroup, cuando pasa a FREE o PAID.
 *
 * Sólo el checkout gratis conoce al comprador. Mercado Pago y la transferencia
 * se confirman en otro request (webhook, admin), así que el evento va sin
 * persona y se cruza con `checkout_submitted` por `ticket_group_id`.
 *
 * Nunca lanza: un fallo de analítica no puede frenar la entrega de entradas.
 */
export async function capturePurchaseCompleted(
  db: Db,
  instance: ResolvedInstance,
  {
    ticketGroupId,
    paymentMethod,
    buyer,
  }: {
    ticketGroupId: string;
    paymentMethod: PurchasePaymentMethod;
    buyer?: Buyer;
  },
) {
  const posthog = getPostHogServer();
  if (!posthog) return;

  try {
    const group = await db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.id, ticketGroupId),
      columns: {
        id: true,
        eventId: true,
        totalAmount: true,
        invitedById: true,
      },
      with: {
        event: { columns: { name: true } },
        ticketTypePerGroups: { columns: { amount: true } },
      },
    });

    if (!group) {
      logger.warn('purchase_completed skipped: ticketGroup not found', {
        ticketGroupId,
      });
      return;
    }

    await posthog.captureImmediate({
      distinctId: buyer?.distinctId ?? `ticketGroup / ${group.id}`,
      event: 'purchase_completed',
      properties: {
        ...(buyer?.distinctId ? {} : { $process_person_profile: false }),
        $session_id: buyer?.sessionId,
        // Mismas propiedades de instancia que `before_send` en el navegador.
        app_area: 'tenant',
        instance_mode: instance.slug ? 'multi-tenant' : 'single-tenant',
        instance_key: instanceAnalyticsKey(instance),
        instance_name: instance.name,
        event_id: group.eventId,
        event_name: group.event.name,
        ticket_group_id: group.id,
        ticket_count: group.ticketTypePerGroups.reduce(
          (count, ticketType) => count + ticketType.amount,
          0,
        ),
        ticket_type_count: group.ticketTypePerGroups.length,
        // Lo que pagó el comprador: con cargo por servicio y descuento.
        amount: paymentMethod === 'free' ? 0 : Number(group.totalAmount),
        currency: 'ARS',
        payment_method: paymentMethod,
        has_organizer: group.invitedById !== null,
      },
    });
  } catch (error) {
    logger.warn('purchase_completed capture failed', { ticketGroupId, error });
  }
}
