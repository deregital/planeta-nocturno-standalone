import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { checkFeature } from '@/components/admin/config/checkFeature';
import { ticketGroup } from '@/drizzle/schema';
import { FEATURE_KEYS } from '@/server/constants/feature-keys';

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

  let totalPrice = group.ticketTypePerGroups.reduce((total, ticketType) => {
    return total + ticketType.amount * (ticketType.ticketType.price ?? 0);
  }, 0);

  await checkFeature(
    FEATURE_KEYS.SERVICE_FEE,
    (serviceFee) => (totalPrice += totalPrice * (serviceFee / 100)),
  );

  return totalPrice;
}
