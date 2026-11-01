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
  if (redeemed.status === 'already_used') {
    redirect(`/event/${slug}?error=code_already_used`);
  }
  if (redeemed.status === 'invalid_configuration') {
    redirect(`/event/${slug}?error=invalid_configuration`);
  }

  const cookiesStore = await cookies();
  cookiesStore.set('carrito', redeemed.ticketGroupId);

  redirect('/checkout');
}
