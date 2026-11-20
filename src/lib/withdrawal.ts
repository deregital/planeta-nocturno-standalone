/**
 * Botón de arrepentimiento (Disp. SSDCyLC 954/2025, Ley 24.240 art. 34 y CCyC
 * arts. 1110-1116). Lo que comparten la página pública, el backoffice y los
 * mails.
 */

export const WITHDRAWAL_PATH = '/arrepentimiento';

/** Días corridos desde la entrega de la entrada o el pago. */
export const WITHDRAWAL_DAYS = 10;

/** El pedido tiene que llegar al menos estas horas antes del evento. */
export const WITHDRAWAL_MIN_HOURS_BEFORE_EVENT = 24;

/** Lo que dura el link que llega por mail. */
export const WITHDRAWAL_LINK_TTL_HOURS = 24;

/** Número de trámite que ve el comprador: ARR-000123. */
export function formatWithdrawalNumber(number: number) {
  return `ARR-${String(number).padStart(6, '0')}`;
}

/** Por qué una compra no se puede arrepentir, en el texto que ve el comprador. */
export const WITHDRAWAL_INELIGIBLE_REASONS = {
  free: 'Es una entrada sin cargo',
  on_site: 'Se compró en la boletería',
  used: 'La entrada ya se usó',
  event_started: 'El evento ya empezó',
  too_close: 'Faltan menos de 24 horas para el evento',
  expired: 'Pasaron más de 10 días desde la compra',
} as const;

export type WithdrawalIneligibleReason =
  keyof typeof WITHDRAWAL_INELIGIBLE_REASONS;

export const WITHDRAWAL_PAYMENT_METHOD_LABELS = {
  MERCADO_PAGO: 'Mercado Pago',
  TRANSFER: 'Transferencia',
  ON_SITE: 'En el lugar',
} as const;

export function withdrawalPaymentMethodLabel(
  method: keyof typeof WITHDRAWAL_PAYMENT_METHOD_LABELS | null,
) {
  return method ? WITHDRAWAL_PAYMENT_METHOD_LABELS[method] : 'Sin dato';
}

/** "Por el mismo medio de pago", dicho para el comprador. */
export function withdrawalRefundChannel(
  method: keyof typeof WITHDRAWAL_PAYMENT_METHOD_LABELS | null,
) {
  if (method === 'MERCADO_PAGO') return 'por Mercado Pago';
  if (method === 'TRANSFER') return 'por transferencia';
  return 'por el mismo medio de pago';
}
