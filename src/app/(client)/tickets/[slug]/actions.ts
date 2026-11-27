'use server';

import type { PaymentMethod } from '@/server/types';

import { TRPCError } from '@trpc/server';

import { logger } from '@/server/observability/logger';
import { trpc } from '@/server/trpc/server';

export type StartPaymentResult =
  /** Ir a pagar a la página del proveedor. */
  | { url: string }
  /** Quedan los datos para transferir: hay que volver a cargar la página. */
  | { instructions: true }
  | { error: string };

/**
 * Inicia el pago de una reserva que todavía no se pagó: reintentar el mismo
 * medio o pasar a otro.
 */
export async function startPaymentFor(
  ticketGroupId: string,
  method: Exclude<PaymentMethod, 'ON_SITE'>,
): Promise<StartPaymentResult> {
  try {
    const payment = await trpc.payments.start({ ticketGroupId, method });
    return payment.type === 'redirect'
      ? { url: payment.url }
      : { instructions: true };
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      return { error: 'Tu reserva venció. Volvé a elegir tus entradas.' };
    }
    if (
      error instanceof TRPCError &&
      (error.code === 'PRECONDITION_FAILED' || error.code === 'BAD_REQUEST')
    ) {
      return { error: error.message };
    }
    logger.error('Payment start failed', { ticketGroupId, method, error });
    return {
      error: 'No pudimos iniciar el pago. Probá de nuevo en un momento.',
    };
  }
}
