'use server';
import { trpc } from '@/server/trpc/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const handlePurchase = async (
  prevState: unknown,
  {
    eventId,
    ticketsPerType,
  }: {
    eventId: string;
    ticketsPerType: { ticketTypeId: string; amount: number }[];
  },
) => {
  // if (quantity === '0') return;
  // if (ticketsAvailable < parseInt(quantity)) return;

  await trpc.ticketGroup
    .create({
      eventId,
      ticketsPerType,
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
