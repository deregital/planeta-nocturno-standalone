import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';
import { calculateTotalPriceFromData } from '@/lib/utils';

export async function calculateTotalPrice({
  ticketGroupId,
  discountPercentage,
}: {
  ticketGroupId: string;
  discountPercentage?: number | null;
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
      event: {
        columns: {
          serviceFee: true,
        },
      },
    },
  });

  if (!group) {
    throw new Error('ticketGroup no encontrado');
  }

  // Calculate subtotal
  const subtotalPrice = group.ticketTypePerGroups.reduce(
    (total, ticketType) => {
      return total + ticketType.amount * (ticketType.ticketType.price ?? 0);
    },
    0,
  );

  const totalPrice = calculateTotalPriceFromData({
    subtotalPrice,
    serviceFee: group.event.serviceFee,
    discountPercentage,
  });

  return totalPrice;
}
