import type { PaymentProvider } from '@/server/payments/types';
import type { PaymentMethod } from '@/server/types';

import { mercadoPagoProvider } from '@/server/payments/providers/mercado-pago';
import { transferProvider } from '@/server/payments/providers/transfer';

/**
 * Todos los medios de pago. Para sumar uno nuevo se escribe su proveedor y se
 * agrega acá. El orden en que se ofrecen lo elige cada plataforma (ver
 * methods.ts); éste es el de los medios que todavía no tienen fila.
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
