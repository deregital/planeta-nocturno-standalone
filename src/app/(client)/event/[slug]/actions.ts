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
