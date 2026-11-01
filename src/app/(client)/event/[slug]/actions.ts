'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';

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
      const ticketTypeIds = ticketsPerType.map((t) => t.ticketTypeId);
      const validation = await trpc.events.validateOrganizerCode({
        eventId,
        code,
        ticketTypeIds,
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
  const redeemed = await trpc.ticketGroup.redeemInvitation({
    eventId,
    code,
  });

  if (redeemed.status === 'invalid_code') {
    return {
      error: 'Código de invitación inválido',
      message:
        'El código de invitación proporcionado no es válido para este evento o no está asignado. Por favor, verificá el código e intentá nuevamente.',
    };
  }

  if (redeemed.status === 'already_used') {
    return {
      error: 'Código ya utilizado',
      message:
        'Este código de invitación ya fue utilizado anteriormente. Cada código solo puede ser usado una vez.',
    };
  }

  if (redeemed.status === 'invalid_configuration') {
    return {
      error: 'Configuración inválida',
      message:
        'Este evento no tiene un único tipo de ticket configurado (excluyendo el ticket de organizador). Por favor, contactá al organizador.',
    };
  }

  const cookiesStore = await cookies();
  cookiesStore.set('carrito', redeemed.ticketGroupId);

  redirect('/checkout');
};
