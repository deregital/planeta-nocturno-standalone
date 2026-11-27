'use server';

import { cookies } from 'next/headers';

import { logger } from '@/server/observability/logger';
import { ticketAccessCookie } from '@/server/security/ticket-access';
import { trpc } from '@/server/trpc/server';

export type VerifyHolderResult =
  | { status: 'ok'; ticketGroupId: string }
  | { status: 'invalid' | 'rate_limited' | 'error' };

/** DNI de un titular para abrir `/tickets/[id]`: si coincide, deja la cookie. */
export async function verifyTicketHolder(
  ticketGroupId: string,
  dni: string,
): Promise<VerifyHolderResult> {
  try {
    const result = await trpc.ticketGroup.verifyTicketHolder({
      ticketGroupId,
      dni,
    });
    if (result.status !== 'ok') return result;
    (await cookies()).set(ticketAccessCookie(ticketGroupId));
    return { status: 'ok', ticketGroupId };
  } catch (error) {
    logger.error('Ticket holder verification failed', { ticketGroupId, error });
    return { status: 'error' };
  }
}

/** Lo mismo desde el link de una invitación ya usada (`/event/[slug]/ticket`). */
export async function verifyInvitationHolder(
  eventSlug: string,
  code: string,
  dni: string,
): Promise<VerifyHolderResult> {
  try {
    const result = await trpc.ticketGroup.verifyInvitationHolder({
      eventSlug,
      code,
      dni,
    });
    if (result.status !== 'ok') return result;
    (await cookies()).set(ticketAccessCookie(result.ticketGroupId));
    return result;
  } catch (error) {
    logger.error('Invitation holder verification failed', { eventSlug, error });
    return { status: 'error' };
  }
}
