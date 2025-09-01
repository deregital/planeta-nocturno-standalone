// src/server/services/ticketGroup.ts

import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';

export async function calculateTotalPrice({
  ticketGroupId,
}: {
  ticketGroupId: string;
}) {
  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    with: {
      ticketTypePerGroups: {
        with: {
          ticketType: {
            columns: {
              price: true,
            },
          },
        },
        columns: {
          amount: true,
        },
      },
    },
  });

  if (!group) {
    throw new Error('ticketGroup no encontrado');
  }

  const totalPrice = group.ticketTypePerGroups.reduce((total, ticketType) => {
    return total + ticketType.amount * (ticketType.ticketType.price ?? 0);
  }, 0);

  return totalPrice;
}
