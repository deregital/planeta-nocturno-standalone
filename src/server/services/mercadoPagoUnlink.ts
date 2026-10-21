import 'server-only';

import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { createHash, createHmac, timingSafeEqual } from 'crypto';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getControlDb } from '@/db/control/client';
import { tenants } from '@/db/control/schema';
import { invalidateTenantLookups } from '@/server/instance/resolve-instance';
import { signPayload } from '@/server/security/signed-request';

export const UNLINK_REQUEST_TTL_MINUTES = 30;
export const MERCADO_PAGO_UNLINK_PATH = '/admin/settings/mercadopago/unlink';
const UNLINK_REQUEST_COOLDOWN_MS = 60_000;
const PLUTO_REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_PURPOSE = 'mercadopago-unlink';

type UnlinkInstance = Pick<
  ResolvedInstance,
  'tenantId' | 'publicUrl' | 'mercadoPagoRefreshToken'
>;

const tokenPayloadSchema = z.object({
  userId: z.string(),
  credentials: z.string(),
  expiresAt: z.number(),
});

function getSigningSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error('Missing AUTH_SECRET environment variable');
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac('sha256', getSigningSecret())
    .update(`${TOKEN_PURPOSE}.${encodedPayload}`)
    .digest('base64url');
}

/**
 * Huella de las credenciales vinculadas: el link deja de servir apenas se
 * desvincula o se vincula otra cuenta, sin guardar nada en la base.
 */
function credentialsFingerprint(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

export function createUnlinkToken(instance: UnlinkInstance, userId: string) {
  if (!instance.mercadoPagoRefreshToken) {
    throw new Error('Mercado Pago is not linked');
  }

  const encodedPayload = Buffer.from(
    JSON.stringify({
      userId,
      credentials: credentialsFingerprint(instance.mercadoPagoRefreshToken),
      expiresAt: Date.now() + UNLINK_REQUEST_TTL_MINUTES * 60_000,
    } satisfies z.infer<typeof tokenPayloadSchema>),
  ).toString('base64url');

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function isUnlinkTokenValid(
  instance: UnlinkInstance,
  token: string,
  userId: string,
) {
  const [encodedPayload, signature, ...rest] = token.split('.');
  if (!encodedPayload || !signature || rest.length > 0) return false;

  const expected = Buffer.from(sign(encodedPayload));
  const received = Buffer.from(signature);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return false;
  }

  let payload: z.infer<typeof tokenPayloadSchema>;
  try {
    const parsed = tokenPayloadSchema.safeParse(
      JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()),
    );
    if (!parsed.success) return false;
    payload = parsed.data;
  } catch {
    return false;
  }

  return (
    payload.userId === userId &&
    payload.expiresAt > Date.now() &&
    !!instance.mercadoPagoRefreshToken &&
    payload.credentials ===
      credentialsFingerprint(instance.mercadoPagoRefreshToken)
  );
}

/** Desvincula si el token es válido. Devuelve `null` si no lo es. */
export async function confirmUnlink(
  instance: UnlinkInstance,
  token: string,
  userId: string,
) {
  if (!isUnlinkTokenValid(instance, token, userId)) return null;
  return unlinkMercadoPago(instance);
}

// Solo frena el envío repetido de mails: es por proceso y se pierde al reiniciar.
const lastRequestByUser = new Map<string, number>();

/** Devuelve `false` si el usuario pidió otro mail hace menos de un minuto. */
export function reserveUnlinkRequest(userId: string) {
  const now = Date.now();
  for (const [key, requestedAt] of lastRequestByUser) {
    if (now - requestedAt >= UNLINK_REQUEST_COOLDOWN_MS) {
      lastRequestByUser.delete(key);
    }
  }

  if (lastRequestByUser.has(userId)) return false;
  lastRequestByUser.set(userId, now);
  return true;
}

export function releaseUnlinkRequest(userId: string) {
  lastRequestByUser.delete(userId);
}

/**
 * En single-tenant las credenciales son variables de entorno que administra
 * Pluto: se quitan recién con el próximo despliegue (`pending`).
 */
async function unlinkMercadoPago(
  instance: UnlinkInstance,
): Promise<{ pending: boolean }> {
  if (instance.tenantId) {
    await getControlDb()
      .update(tenants)
      .set({
        mpAccessToken: null,
        mpRefreshToken: null,
        mpAccessTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, instance.tenantId));
    invalidateTenantLookups();
    return { pending: false };
  }

  await revokeSingleTenantCredentials(instance.publicUrl);
  return { pending: true };
}

async function revokeSingleTenantCredentials(publicUrl: string) {
  if (!process.env.PLUTO_URL) {
    throw new Error('Missing PLUTO_URL environment variable');
  }

  const timestamp = Date.now().toString();
  const rawBody = JSON.stringify({ projectUrl: publicUrl });
  const signature = signPayload(timestamp, rawBody);
  if (!signature) {
    throw new Error('Missing CREDENTIALS_SIGNING_SECRET environment variable');
  }

  const response = await fetch(
    `${process.env.PLUTO_URL}/api/credentials/mercadopago/revoke`,
    {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-timestamp': timestamp,
        'x-signature': `sha256=${signature}`,
      },
      body: rawBody,
      signal: AbortSignal.timeout(PLUTO_REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Pluto rejected the Mercado Pago revoke request (${response.status})`,
    );
  }
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}
