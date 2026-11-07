import type { NextRequest } from 'next/server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';

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

  const redeemed = await trpc.ticketGroup.redeemInvitation({
    eventId: event.id,
    code: invitationCode,
  });

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

  const cookiesStore = await cookies();
  cookiesStore.set('carrito', redeemed.ticketGroupId);

  redirect('/checkout');
}
