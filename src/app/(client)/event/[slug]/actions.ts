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
  await trpc.ticketGroup
    .create({
      eventId,
      ticketsPerType,
      invitedBy,
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
