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

export const REFUND_ACCOUNT_LABEL = 'CBU, CVU o alias para la devolución';

export type RefundAccount = { kind: 'cbu' | 'alias'; value: string };

/** Dígito verificador de un bloque de CBU/CVU (mismo cálculo para los dos). */
function cbuBlockIsValid(block: string, weights: number[]) {
  const sum = weights.reduce((acc, w, i) => acc + Number(block[i]) * w, 0);
  return (10 - (sum % 10)) % 10 === Number(block[block.length - 1]);
}

/**
 * CBU o CVU (22 números, con sus dos dígitos verificadores) o alias (de 6 a
 * 20 letras, números, puntos o guiones). Un número mal tipeado manda la plata
 * a otra cuenta: por eso se revisan los verificadores.
 */
export function parseRefundAccount(
  raw: string,
): { ok: true; account: RefundAccount } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) {
    return { ok: false, error: 'Ingresá el CBU, CVU o alias de tu cuenta.' };
  }
  const digits = value.replace(/[\s-]/g, '');
  if (/^\d+$/.test(digits)) {
    if (digits.length !== 22) {
      return {
        ok: false,
        error: `El CBU o CVU tiene 22 números (ingresaste ${digits.length}).`,
      };
    }
    const valid =
      cbuBlockIsValid(digits.slice(0, 8), [7, 1, 3, 9, 7, 1, 3]) &&
      cbuBlockIsValid(digits.slice(8), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]);
    if (!valid) {
      return {
        ok: false,
        error: 'Revisá el CBU o CVU: algún número no coincide.',
      };
    }
    return { ok: true, account: { kind: 'cbu', value: digits } };
  }
  if (!/^[a-zA-Z0-9.-]{6,20}$/.test(value)) {
    return {
      ok: false,
      error:
        'El alias tiene de 6 a 20 letras, números, puntos o guiones, sin espacios.',
    };
  }
  return { ok: true, account: { kind: 'alias', value: value.toUpperCase() } };
}
