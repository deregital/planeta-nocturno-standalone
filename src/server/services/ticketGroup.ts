import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';

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

  // Calculate service fee over subtotal (pre-discount)
  let serviceFeePrice = 0;
  if (group.event.serviceFee) {
    serviceFeePrice = subtotalPrice * (group.event.serviceFee / 100);
  }

  // Apply discount to subtotal if exists
  const hasDiscount =
    discountPercentage !== null &&
    discountPercentage !== undefined &&
    discountPercentage > 0;
  const subtotalWithDiscount = hasDiscount
    ? subtotalPrice * (1 - discountPercentage / 100)
    : subtotalPrice;

  // Total = subtotal with discount + service fee
  const totalPrice = subtotalWithDiscount + serviceFeePrice;

  return totalPrice;
}
