import type { NextRequest } from 'next/server';

import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';

/**
 * Los links llegan copiados de WhatsApp o Instagram: con espacios, un punto
 * final o en minúsculas. Lo que no sea un código de 6 hex es inválido (antes
 * daba un 500 con la pantalla en blanco).
 */
function normalizeInvitationCode(raw: string) {
  const code = raw
    .trim()
    .replace(/^[^0-9a-z]+|[^0-9a-z]+$/gi, '')
    .toUpperCase();
  return /^[0-9A-F]{6}$/.test(code) ? code : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const invitationCode = searchParams.get('invite');

  if (!invitationCode) {
    redirect(`/event/${slug}?error=missing_code`);
  }

  // Obtener el evento. También libera reservas BOOKED vencidas.
  const event = await trpc.events.getPublicBySlug(slug);
  if (!event) {
    redirect(`/event/${slug}?error=event_not_found`);
  }

  const code = normalizeInvitationCode(invitationCode);
  if (!code) {
    redirect(`/event/${slug}?error=invalid_code`);
  }

  const cookiesStore = await cookies();
  const cart = cookiesStore.get('carrito')?.value;
  const redeemed = await trpc.ticketGroup
    .redeemInvitation({
      eventId: event.id,
      code,
      currentTicketGroupId: cart && UUID_PATTERN.test(cart) ? cart : null,
    })
    .catch((error: unknown) => {
      // La venta del tipo ya cerró (maxSellDate): BAD_REQUEST con el motivo.
      if (error instanceof TRPCError && error.code === 'BAD_REQUEST') {
        return { status: 'sale_closed' as const };
      }
      throw error;
    });

  if (redeemed.status === 'event_blocked') {
    // Mismo resultado que abrir el evento sin código: no se muestra.
    redirect(`/event/${slug}`);
  }
  if (redeemed.status === 'invalid_code') {
    redirect(`/event/${slug}?error=invalid_code`);
  }
  if (redeemed.status === 'rate_limited') {
    redirect(`/event/${slug}?error=too_many_attempts`);
  }
  if (redeemed.status === 'already_used') {
    // El ticket ya fue emitido: se muestra recién después de confirmar el DNI.
    redirect(
      `/event/${slug}/ticket?invite=${encodeURIComponent(invitationCode)}`,
    );
  }
  if (redeemed.status === 'invalid_configuration') {
    redirect(`/event/${slug}?error=invalid_configuration`);
  }
  if (redeemed.status === 'sale_closed') {
    redirect(`/event/${slug}?error=sale_closed`);
  }

  cookiesStore.set('carrito', redeemed.ticketGroupId);

  redirect('/checkout');
}
