'use server';

import { TRPCError } from '@trpc/server';

import { logger } from '@/server/observability/logger';
import { trpc } from '@/server/trpc/server';

/** Abre una preferencia nueva para una reserva que todavía no se pagó. */
export async function retryMercadoPagoPayment(
  ticketGroupId: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const url = await trpc.mercadoPago.createPreference({ ticketGroupId });
    return { url };
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      return { error: 'Tu reserva venció. Volvé a elegir tus entradas.' };
    }
    logger.error('Mercado Pago payment retry failed', { ticketGroupId, error });
    return {
      error: 'No pudimos abrir Mercado Pago. Probá de nuevo en un momento.',
    };
  }
}
