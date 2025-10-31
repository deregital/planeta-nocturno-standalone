import type { NextRequest } from 'next/server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

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

  // Obtener el evento
  const event = await trpc.events.getBySlug(slug);
  if (!event) {
    redirect(`/event/${slug}?error=event_not_found`);
  }

  // Validar que el código sea válido para este evento
  const validation = await trpc.events.validateInvitationCode({
    eventId: event.id,
    code: invitationCode,
  });

  if (!validation.valid || !validation.organizerId) {
    // Si el código ya fue usado, mostrar error específico
    if (validation.alreadyUsed) {
      redirect(`/event/${slug}?error=code_already_used`);
    }
    redirect(`/event/${slug}?error=invalid_code`);
  }

  // Obtener el evento completo para verificar los ticketTypes
  const eventFull = await trpc.events.getById(event.id);
  if (!eventFull) {
    redirect(`/event/${slug}?error=event_not_found`);
  }

  // Verificar que el evento tenga exactamente 1 ticketType (excluyendo el de organizador)
  const nonOrganizerTicketTypes = eventFull.ticketTypes.filter(
    (tt) => tt.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
  );

  if (nonOrganizerTicketTypes.length !== 1) {
    redirect(`/event/${slug}?error=invalid_configuration`);
  }

  const ticketType = nonOrganizerTicketTypes[0];

  // Crear el ticketGroup automáticamente
  const ticketGroupId = await trpc.ticketGroup.create({
    eventId: event.id,
    ticketsPerType: [
      {
        ticketTypeId: ticketType.id,
        amount: 1,
      },
    ],
    invitedBy: validation.organizerId,
  });

  // Actualizar el ticketXorganizer con el ticketGroupId
  await trpc.ticketGroup.updateTicketXOrganizerTicketGroupId({
    code: invitationCode.toUpperCase(),
    eventId: event.id,
    ticketGroupId,
  });

  // Guardar el ticketGroupId en la cookie y redirigir al checkout
  const cookiesStore = await cookies();
  cookiesStore.set('carrito', ticketGroupId);

  redirect('/checkout');
}
