'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export const handlePurchase = async (
  prevState: unknown,
  {
    eventId,
    ticketsPerType,
    invitedBy,
  }: {
    eventId: string;
    ticketsPerType: { ticketTypeId: string; amount: number }[];
    invitedBy: string | null;
  },
) => {
  // Validar el código del organizador si existe
  let organizerId: string | null = null;
  if (invitedBy && invitedBy.trim() !== '') {
    const code = invitedBy.toUpperCase().trim();
    if (code.length === 6) {
      const validation = await trpc.events.validateOrganizerCode({
        eventId,
        code,
      });

      if (validation.valid && validation.organizerId) {
        organizerId = validation.organizerId;
      }
      // Si no es válido, organizerId queda como null
    }
  }

  await trpc.ticketGroup
    .create({
      eventId,
      ticketsPerType,
      invitedBy: organizerId,
    })
    .then(async (ticketGroupId) => {
      if (!ticketGroupId) {
        throw new Error('No se pudo crear el grupo de tickets');
      }

      const cookiesStore = await cookies();
      cookiesStore.set('carrito', ticketGroupId);

      redirect('/checkout');
    });
};

export const handleInvitationCode = async ({
  eventId,
  code,
}: {
  eventId: string;
  code: string;
}) => {
  // Validar que el código sea válido para este evento
  const validation = await trpc.events.validateInvitationCode({
    eventId,
    code,
  });

  if (!validation.valid || !validation.organizerId) {
    return {
      error: 'Código de invitación inválido',
      message:
        'El código de invitación proporcionado no es válido para este evento o no está asignado. Por favor, verificá el código e intentá nuevamente.',
    };
  }

  // Obtener el evento para verificar los ticketTypes
  const event = await trpc.events.getById(eventId);
  if (!event) {
    return {
      error: 'Evento no encontrado',
      message: 'El evento no existe o no se pudo encontrar.',
    };
  }

  // Verificar que el evento tenga exactamente 1 ticketType (excluyendo el de organizador)
  const nonOrganizerTicketTypes = event.ticketTypes.filter(
    (tt) => tt.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
  );

  if (nonOrganizerTicketTypes.length !== 1) {
    return {
      error: 'Configuración inválida',
      message:
        'Este evento no tiene un único tipo de ticket configurado (excluyendo el ticket de organizador). Por favor, contactá al organizador.',
    };
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

  // Guardar el ticketGroupId en la cookie y redirigir al checkout
  const cookiesStore = await cookies();
  cookiesStore.set('carrito', ticketGroupId);

  redirect('/checkout');
};
