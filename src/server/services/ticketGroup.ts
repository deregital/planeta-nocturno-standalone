import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { checkFeature } from '@/components/admin/config/checkFeature';
import { ticketGroup } from '@/drizzle/schema';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';

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
  await checkFeature(FEATURE_KEYS.SERVICE_FEE, (serviceFee) => {
    serviceFeePrice = subtotalPrice * (serviceFee / 100);
  });

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
