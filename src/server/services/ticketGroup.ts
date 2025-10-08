// src/server/services/ticketGroup.ts

import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { feature, ticketGroup } from '@/drizzle/schema';
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

  const serviceFee = await db.query.feature.findFirst({
    where: eq(feature.key, FEATURE_KEYS.SERVICE_FEE),
  });

  if (serviceFee?.enabled) {
    totalPrice += totalPrice * Number(serviceFee.value);
  }

  return totalPrice;
}
