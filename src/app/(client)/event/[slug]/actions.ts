'use server';
import { TRPCError } from '@trpc/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { trpc } from '@/server/trpc/server';

export type EventPurchaseState = { error: string } | undefined;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const handlePurchase = async (
  prevState: EventPurchaseState,
  {
    eventId,
    ticketsPerType,
    invitedBy,
  }: {
    eventId: string;
    ticketsPerType: { ticketTypeId: string; amount: number }[];
    invitedBy: string | null;
  },
): Promise<EventPurchaseState> => {
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

  const cookiesStore = await cookies();
  const previousCart = cookiesStore.get('carrito')?.value;

  let ticketGroupId: string;
  try {
    ticketGroupId = await trpc.ticketGroup.create({
      eventId,
      ticketsPerType,
      invitedBy: organizerId,
      previousTicketGroupId:
        previousCart && UUID_PATTERN.test(previousCart) ? previousCart : null,
    });
  } catch (error) {
    // Cupo agotado (alguien se adelantó), venta cerrada o tope por compra:
    // antes subía sin capturar y se veía "Algo salió mal".
    if (
      error instanceof TRPCError &&
      (error.code === 'CONFLICT' || error.code === 'BAD_REQUEST')
    ) {
      return {
        error:
          error.code === 'CONFLICT'
            ? `${error.message}: alguien se te adelantó. Elegí de nuevo.`
            : error.message,
      };
    }
    throw error;
  }

  cookiesStore.set('carrito', ticketGroupId);
  redirect('/checkout');
};
