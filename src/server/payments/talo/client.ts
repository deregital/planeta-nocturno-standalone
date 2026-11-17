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
 * Credenciales de partner de la plataforma (https://docs.talo.com.ar/partners).
 * Sin ellas, Talo no se puede conectar.
 */
export function taloPartner() {
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
});

export type TaloPayment = z.infer<typeof paymentSchema>;

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
