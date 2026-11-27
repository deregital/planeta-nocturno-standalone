import { z } from 'zod';

/**
 * API de Talo (https://docs.talo.com.ar). Por defecto el sandbox: para cobrar
 * de verdad, TALO_API_URL=https://api.talo.com.ar.
 */
export function taloApiUrl() {
  return (
    process.env.TALO_API_URL ?? 'https://sandbox-api.talo.com.ar'
  ).replace(/\/+$/, '');
}

/**
 * Pantalla de autorización de Talo (Conectar con Talo). Por defecto la del
 * sandbox si la API es la del sandbox.
 */
export function taloAppUrl() {
  const fallback = taloApiUrl().includes('sandbox')
    ? 'https://sandbox.talo.com.ar'
    : 'https://app.talo.com.ar';
  return (process.env.TALO_APP_URL ?? fallback).replace(/\/+$/, '');
}

/**
 * Talo se prende a mano con TALO_ENABLED=true. Apagado (lo normal mientras no
 * haya credenciales de producción) no se ofrece a los compradores, no se puede
 * conectar y no aparece en Medios de pago, aunque haya credenciales cargadas.
 * Las compras de Talo que ya existen se siguen procesando (aviso de pago,
 * devoluciones, liberar el cupo).
 */
export function isTaloEnabled() {
  return process.env.TALO_ENABLED?.trim() === 'true';
}

/**
 * Credenciales de partner de la plataforma (https://docs.talo.com.ar/partners).
 * Sin ellas, o con Talo apagado, Talo no se puede conectar.
 */
export function taloPartner() {
  if (!isTaloEnabled()) return null;
  const id = process.env.TALO_PARTNER_ID?.trim();
  const secret = process.env.TALO_PARTNER_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

/** La cuenta de Talo de una plataforma, conectada por OAuth de partner. */
export type TaloConnection = {
  userId: string;
  /** Token de partner (PAR-…) para operar a nombre de la cuenta. */
  token: string;
};

export const TALO_ACCOUNT_STATUSES = [
  'ACTIVE',
  'PENDING',
  'REJECTED',
  'SUSPENDED',
] as const;
export type TaloAccountStatus = (typeof TALO_ACCOUNT_STATUSES)[number];

export class TaloError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TaloError';
  }
}

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ data, message: z.string().optional() });

const quoteSchema = z.object({
  // La documentación muestra el CVU como `cvu` al crear y `address` al leer.
  cvu: z.string().optional(),
  address: z.string().optional(),
  alias: z.string().nullish(),
  amount: z.coerce.number().optional(),
  currency: z.string().optional(),
});

export const TALO_PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'OVERPAID',
  'UNDERPAID',
  'EXPIRED',
] as const;

export const TALO_REFUND_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const;

const refundSchema = z
  .object({
    refund_id: z.string().optional(),
    refund_type: z.string().optional(),
    refund_status: z.enum(TALO_REFUND_STATUSES),
    amount: z.coerce.number().optional(),
    creation_timestamp: z.string().optional(),
  })
  .loose();

const paymentSchema = z.object({
  id: z.string().min(1),
  payment_status: z.enum(TALO_PAYMENT_STATUSES),
  external_id: z.string().nullish(),
  payment_url: z.string().nullish(),
  expiration_timestamp: z.string().nullish(),
  price: z
    .object({ amount: z.coerce.number(), currency: z.string() })
    .optional(),
  quotes: z.array(quoteSchema).default([]),
  /** Lo que se acreditó hasta ahora (puede llegar en varias transferencias). */
  transaction_fields: z
    .object({
      total_paid: z.object({ amount: z.coerce.number() }).partial().nullish(),
    })
    .partial()
    .nullish(),
  transactions: z
    .array(
      z
        .object({
          amount: z.coerce.number().optional(),
          transactionType: z.string().optional(),
          is_refund: z.boolean().optional(),
        })
        .loose(),
    )
    .nullish(),
  refunds: z.array(refundSchema).nullish(),
});

export type TaloPayment = z.infer<typeof paymentSchema>;
export type TaloRefund = z.infer<typeof refundSchema>;

/**
 * Cuánto transfirió el comprador en total. Talo suma las transferencias al
 * mismo CVU; sin `total_paid`, se suman las entrantes.
 */
export function taloReceivedAmount(payment: TaloPayment) {
  const total = payment.transaction_fields?.total_paid?.amount;
  if (typeof total === 'number' && Number.isFinite(total)) return total;
  return (payment.transactions ?? [])
    .filter((t) => !t.is_refund && t.transactionType !== 'OUTBOUND')
    .reduce((sum, t) => sum + (t.amount && t.amount > 0 ? t.amount : 0), 0);
}

/** CVU, alias y monto a transferir de un pago. */
export function taloPaymentAccount(payment: TaloPayment) {
  const quote = payment.quotes[0];
  return {
    cvu: quote?.cvu ?? quote?.address ?? null,
    alias: quote?.alias ?? null,
    amount: quote?.amount ?? payment.price?.amount ?? null,
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body) {
    return String((body as { message: unknown }).message);
  }
  return fallback;
}

/**
 * Canjea el código que devuelve la autorización de Talo por el token de
 * partner de la cuenta. El código vence a los 5 minutos.
 */
export async function exchangeTaloCode(code: string) {
  const partner = taloPartner();
  if (!partner) throw new TaloError('Talo no está habilitado', 503);
  const response = await fetch(`${taloApiUrl()}/auth/tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: partner.id,
      client_secret: partner.secret,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new TaloError(
      errorMessage(body, `Talo rechazó el código (${response.status})`),
      response.status,
    );
  }
  return envelope(
    z.object({
      token: z.string().min(1),
      user_id: z.coerce.string().min(1),
      referred_user_id: z.coerce.string().nullish(),
    }),
  ).parse(body).data;
}

async function taloFetch(
  connection: TaloConnection,
  path: string,
  init: { method: string; body?: unknown },
) {
  const response = await fetch(`${taloApiUrl()}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${connection.token}`,
      'content-type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new TaloError(
      errorMessage(body, `Talo respondió ${response.status} en ${path}`),
      response.status,
    );
  }
  return body;
}

/** Estado de la cuenta: Talo la verifica antes de activarla (hasta 36 h). */
export async function getTaloAccountStatus(connection: TaloConnection) {
  const body = await taloFetch(
    connection,
    `/users/${encodeURIComponent(connection.userId)}/account`,
    { method: 'GET' },
  );
  return envelope(
    z.object({ account_status: z.enum(TALO_ACCOUNT_STATUSES) }).loose(),
  ).parse(body).data.account_status;
}

export async function createTaloPayment(
  connection: TaloConnection,
  input: {
    amount: number;
    externalId: string;
    webhookUrl: string;
    redirectUrl: string;
    motive: string;
    client?: { first_name?: string; email?: string; dni?: string };
  },
) {
  const body = await taloFetch(connection, '/payments/', {
    method: 'POST',
    body: {
      price: { amount: input.amount, currency: 'ARS' },
      payment_options: ['transfer'],
      external_id: input.externalId,
      // Talo identifica los cobros que vienen de la plataforma.
      partner_id: taloPartner()?.id,
      webhook_url: input.webhookUrl,
      redirect_url: input.redirectUrl,
      motive: input.motive,
      client_data: input.client,
    },
  });
  return envelope(paymentSchema).parse(body).data;
}

export async function getTaloPayment(
  connection: TaloConnection,
  paymentId: string,
) {
  const body = await taloFetch(
    connection,
    `/payments/${encodeURIComponent(paymentId)}`,
    { method: 'GET' },
  );
  return envelope(paymentSchema).parse(body).data;
}

/**
 * Devuelve plata de un pago a quien la transfirió: todo, o una parte en pesos.
 * Es asíncrono (queda PENDING) y Talo no avisa cuando termina: el estado se
 * lee en el pago. Sólo puede haber una devolución pendiente por pago.
 */
export async function refundTaloPayment(
  connection: TaloConnection,
  paymentId: string,
  refund: { type: 'FULL' } | { type: 'PARTIAL'; amount: number },
) {
  const body = await taloFetch(
    connection,
    `/payments/${encodeURIComponent(paymentId)}/refunds`,
    {
      method: 'POST',
      body:
        refund.type === 'FULL'
          ? { refund_type: 'FULL' }
          : {
              refund_type: 'PARTIAL',
              // La API de devoluciones recibe el monto como texto.
              amount: String(refund.amount),
              currency: 'ARS',
            },
    },
  );
  const payment = envelope(paymentSchema).parse(body).data;
  return payment.refunds?.at(-1) ?? null;
}

/**
 * Cambia el precio de un pago y Talo recalcula su estado: aceptar lo que se
 * recibió deja un UNDERPAID como SUCCESS.
 */
export async function setTaloPaymentPrice(
  connection: TaloConnection,
  paymentId: string,
  amount: number,
) {
  await taloFetch(
    connection,
    `/payments/${encodeURIComponent(paymentId)}/price`,
    {
      method: 'PUT',
      body: { currency: 'ARS', amount },
    },
  );
}

/** Acorta el vencimiento del CVU (sólo pagos PENDING). */
export async function setTaloPaymentExpiration(
  connection: TaloConnection,
  paymentId: string,
  expiresAt: Date,
) {
  await taloFetch(
    connection,
    `/payments/${encodeURIComponent(paymentId)}/expiration`,
    {
      method: 'PUT',
      body: { expiration_timestamp: expiresAt.toISOString() },
    },
  );
}
