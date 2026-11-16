import type {
  PaymentContext,
  PaymentProvider,
  PaymentStart,
} from '@/server/payments/types';
import type { PaymentMethod } from '@/server/types';

import { mercadoPagoProvider } from '@/server/payments/providers/mercado-pago';
import { transferProvider } from '@/server/payments/providers/transfer';
import { logger } from '@/server/observability/logger';

/**
 * Todos los medios de pago, en orden de preferencia. Para sumar uno nuevo se
 * escribe su proveedor y se agrega acá.
 */
export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  mercadoPagoProvider,
  transferProvider,
];

/** Los medios que avisan solos, por el segmento de su URL de aviso. */
export const PAYMENT_WEBHOOK_SLUGS: Record<string, PaymentProvider> = {
  mercadopago: mercadoPagoProvider,
};

export function getPaymentProvider(method: PaymentMethod | null) {
  return PAYMENT_PROVIDERS.find((provider) => provider.method === method);
}

export async function listReadyPaymentProviders(ctx: PaymentContext) {
  const ready = await Promise.all(
    PAYMENT_PROVIDERS.map((provider) => provider.isReady(ctx)),
  );
  return PAYMENT_PROVIDERS.filter((_, index) => ready[index]);
}

/**
 * Inicia el pago con el primer medio listo. Si uno falla prueba el siguiente;
 * si fallan todos, propaga el error del último. Devuelve null si no hay
 * ningún medio configurado.
 */
export async function startFirstReadyPayment(
  ctx: PaymentContext,
  ticketGroupId: string,
): Promise<PaymentStart | null> {
  const providers = await listReadyPaymentProviders(ctx);

  for (const [index, provider] of providers.entries()) {
    try {
      return await provider.start(ctx, ticketGroupId);
    } catch (error) {
      const next = providers[index + 1];
      if (!next) throw error;
      logger.warn('Payment start failed, trying next method', {
        ticketGroupId,
        method: provider.method,
        next: next.method,
        error,
      });
    }
  }
  return null;
}
