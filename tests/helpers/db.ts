import { eq } from 'drizzle-orm';

import { db } from '@/drizzle';

import { ticketGroup } from '@/drizzle/schema';

export async function markTicketGroupAsPaid(ticketGroupId: string) {
  const result = await db
    .update(ticketGroup)
    .set({ status: 'PAID' })
    .where(eq(ticketGroup.id, ticketGroupId))
    .returning({ id: ticketGroup.id });

  if (!result[0]) {
    throw new Error(
      `TicketGroup ${ticketGroupId} no encontrado en la base de datos`,
    );
  }
}
