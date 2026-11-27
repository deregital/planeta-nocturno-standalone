import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Acceso a la página de un ticket (`/tickets/[id]`). Quien conoce el link no
 * alcanza: tiene que probar el DNI de alguno de los titulares, o ser el
 * navegador que hizo la compra. La prueba queda en una cookie firmada por
 * grupo, así no se guarda nada en la base.
 */

const TOKEN_PURPOSE = 'ticket-access';
const COOKIE_PREFIX = 'ticket_access_';

export const TICKET_ACCESS_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

function getSigningSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new Error('Missing AUTH_SECRET environment variable');
  return secret;
}

export function ticketAccessCookieName(ticketGroupId: string) {
  return `${COOKIE_PREFIX}${ticketGroupId}`;
}

export function ticketAccessToken(ticketGroupId: string) {
  return createHmac('sha256', getSigningSecret())
    .update(`${TOKEN_PURPOSE}.${ticketGroupId}`)
    .digest('base64url');
}

/** Opciones de la cookie: la lee también `/api/trpc`, por eso va en `/`. */
export function ticketAccessCookie(ticketGroupId: string) {
  return {
    name: ticketAccessCookieName(ticketGroupId),
    value: ticketAccessToken(ticketGroupId),
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: TICKET_ACCESS_MAX_AGE,
  };
}

function readCookie(headers: Headers, name: string) {
  const header = headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

export function hasTicketAccess(headers: Headers, ticketGroupId: string) {
  const received = readCookie(headers, ticketAccessCookieName(ticketGroupId));
  if (!received) return false;
  const expected = Buffer.from(ticketAccessToken(ticketGroupId));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
