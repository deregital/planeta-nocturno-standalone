import type { PaymentMethod } from '@/server/types';
import type { PurchasePaymentMethod } from '@/server/analytics/purchase-events';
import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import type { Db } from '@/drizzle';

export type PaymentContext = { db: Db; instance: ResolvedInstance };

/** Lo que ve el comprador después de elegir el medio. */
export type PaymentStart =
  /** Se va a pagar a la página del proveedor (Mercado Pago). */
  | { type: 'redirect'; url: string }
  /** Se queda en la compra con los datos para transferir. */
  | { type: 'instructions'; alias: string; amount: number };

/** Lo que dice un aviso del proveedor, ya verificado. */
export type PaymentNotification = {
  ticketGroupId: string;
  status: 'PAID' | 'IGNORE';
};

/**
 * Cuánto retiene el cupo una reserva sin pagar, contado desde que se creó.
 * Sin `hold`, la reserva queda hasta que la cierre el staff.
 */
export type PaymentHold = {
  /** Suelta el cupo pero conserva el grupo, por si el pago llega tarde. */
  releaseAfterMs: number;
  /** Borra el grupo y sus entradas. */
  deleteAfterMs: number;
};

export type PaymentProvider = {
  method: Exclude<PaymentMethod, 'ON_SITE'>;
  label: string;
  analyticsName: Exclude<PurchasePaymentMethod, 'free'>;
  /** `webhook`: se confirma sola. `manual`: la confirma el staff. */
  confirmation: 'webhook' | 'manual';
  hold: PaymentHold | null;
  /** Tiene lo que necesita para cobrar (cuenta vinculada, alias cargado). */
  isConfigured(ctx: PaymentContext): Promise<boolean>;
  /** Deja la reserva esperando este medio y devuelve cómo sigue el comprador. */
  start(ctx: PaymentContext, ticketGroupId: string): Promise<PaymentStart>;
  /**
   * Verifica un aviso del proveedor. Devuelve una Response para cortar el
   * request (firma inválida, body mal formado).
   */
  parseNotification?(request: Request): Promise<PaymentNotification | Response>;
};
