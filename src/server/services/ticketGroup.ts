import type { ResolvedInstance } from '@/server/instance/resolve-instance';

import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Db } from '@/drizzle';

import {
  emittedTicket,
  eventXorganizer,
  ticketGroup,
  ticketType,
  ticketTypePerGroup,
} from '@/drizzle/schema';
import { type TicketGroupStatus } from '@/server/types';
import { calculateTotalPriceFromData } from '@/lib/utils';
import { logger } from '@/server/observability/logger';
import {
  generateTicketEmailBody,
  sendMailService,
} from '@/server/services/mail';
import { sendNotificationService } from '@/server/services/notification';
import { generatePdf } from '@/server/utils/ticket-template';

/**
 * Registra el pago aprobado de un grupo de Mercado Pago. Devuelve false si ya
 * estaba pago: el aviso se reintenta y no hay que volver a entregar.
 *
 * Si la reserva ya había soltado el cupo (pago tardío, ver releaseExpiredHolds),
 * lo vuelve a tomar con las entradas emitidas, aunque el tipo se haya agotado
 * mientras tanto: la plata ya se cobró y la entrada se honra.
 */
export async function markMercadoPagoGroupPaid(db: Db, ticketGroupId: string) {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .select({ status: ticketGroup.status, eventId: ticketGroup.eventId })
      .from(ticketGroup)
      .where(eq(ticketGroup.id, ticketGroupId))
      .for('update');

    if (!group) {
      throw new Error('ticketGroup no encontrado');
    }
    if (group.status !== 'BOOKED') return false;

    const [hold] = await tx
      .select({ ticketTypeId: ticketTypePerGroup.ticketTypeId })
      .from(ticketTypePerGroup)
      .where(eq(ticketTypePerGroup.ticketGroupId, ticketGroupId))
      .limit(1);

    if (!hold) {
      const emitted = await tx
        .select({
          ticketTypeId: emittedTicket.ticketTypeId,
          amount: sql<number>`count(*)::int`,
        })
        .from(emittedTicket)
        .where(eq(emittedTicket.ticketGroupId, ticketGroupId))
        .groupBy(emittedTicket.ticketTypeId);

      if (emitted.length > 0) {
        const typeIds = emitted.map((row) => row.ticketTypeId);
        const types = await tx
          .select({
            id: ticketType.id,
            name: ticketType.name,
            maxAvailable: ticketType.maxAvailable,
          })
          .from(ticketType)
          .where(inArray(ticketType.id, typeIds))
          .orderBy(ticketType.id)
          .for('update');
        const taken = await tx
          .select({
            ticketTypeId: ticketTypePerGroup.ticketTypeId,
            taken: sql<number>`coalesce(sum(${ticketTypePerGroup.amount}), 0)::int`,
          })
          .from(ticketTypePerGroup)
          .where(inArray(ticketTypePerGroup.ticketTypeId, typeIds))
          .groupBy(ticketTypePerGroup.ticketTypeId);
        const takenByType = new Map(
          taken.map((row) => [row.ticketTypeId, Number(row.taken)]),
        );

        for (const row of emitted) {
          const type = types.find((t) => t.id === row.ticketTypeId);
          const after = (takenByType.get(row.ticketTypeId) ?? 0) + row.amount;
          if (type && after > type.maxAvailable) {
            logger.warn('Late payment honored over ticket type quota', {
              operation: 'payment_webhook',
              ticketGroupId,
              ticketTypeId: type.id,
              ticketTypeName: type.name,
              maxAvailable: type.maxAvailable,
              taken: after,
            });
          }
        }

        await tx.insert(ticketTypePerGroup).values(
          emitted.map((row) => ({
            ticketGroupId,
            ticketTypeId: row.ticketTypeId,
            amount: Number(row.amount),
          })),
        );
      }
    }

    await tx
      .update(ticketGroup)
      .set({ status: 'PAID' })
      .where(eq(ticketGroup.id, ticketGroupId));
    return true;
  });
}

export async function updateTicketGroupStatus(
  db: Db,
  id: string,
  status: TicketGroupStatus,
) {
  const result = await db
    .update(ticketGroup)
    .set({ status })
    .where(eq(ticketGroup.id, id))
    .returning();

  if (!result[0]) {
    throw new Error('ticketGroup no encontrado');
  }

  return result[0];
}

export async function calculateTotalPrice(
  db: Db,
  {
    ticketGroupId,
    discountPercentage,
  }: {
    ticketGroupId: string;
    discountPercentage?: number | null;
  },
) {
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

/**
 * Total a cobrar con el descuento del organizador que invitó (si tiene) y lo
 * guarda en el ticketGroup.
 */
export async function calculateAndSaveTotalAmount(
  db: Db,
  ticketGroupId: string,
) {
  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    columns: { eventId: true, invitedById: true },
  });

  if (!group) {
    throw new Error('ticketGroup no encontrado');
  }

  let discountPercentage: number | null = null;
  if (group.invitedById) {
    const eventOrganizer = await db.query.eventXorganizer.findFirst({
      where: and(
        eq(eventXorganizer.eventId, group.eventId),
        eq(eventXorganizer.organizerId, group.invitedById),
      ),
      columns: {
        discountPercentage: true,
      },
    });

    if (eventOrganizer?.discountPercentage) {
      discountPercentage = eventOrganizer.discountPercentage;
    }
  }

  const totalPrice = await calculateTotalPrice(db, {
    ticketGroupId,
    discountPercentage,
  });

  await db
    .update(ticketGroup)
    .set({
      totalAmount: totalPrice.toFixed(2),
    })
    .where(eq(ticketGroup.id, ticketGroupId));

  return totalPrice;
}

export async function generateTicketGroupPdfs(
  db: Db,
  instance: ResolvedInstance,
  ticketGroupId: string,
) {
  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    columns: { status: true, invitedById: true },
    with: {
      user: { columns: { fullName: true } },
      emittedTickets: {
        columns: {
          id: true,
          fullName: true,
          mail: true,
          dni: true,
          createdAt: true,
          slug: true,
        },
        with: {
          ticketType: {
            columns: { id: true, name: true, startingDate: true },
          },
        },
      },
      event: {
        columns: {
          name: true,
          startingDate: true,
          ticketSlugVisibleInPdf: true,
        },
        with: { location: { columns: { address: true } } },
      },
    },
  });

  if (!group) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'TicketGroup no encontrado',
    });
  }

  if (!group.emittedTickets?.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No hay tickets emitidos',
    });
  }

  return await Promise.all(
    group.emittedTickets.map(async (ticket) => {
      const blob = await generatePdf(
        {
          eventName: group.event.name,
          startingDate: ticket.ticketType.startingDate,
          eventStartingDate: group.event.startingDate,
          eventLocation: group.event.location?.address ?? '',
          createdAt: ticket.createdAt,
          dni: ticket.dni,
          fullName: ticket.fullName,
          id: ticket.id,
          ticketType: ticket.ticketType.name,
          invitedBy: group.user?.fullName ?? '-',
          slug: ticket.slug,
          ticketSlugVisibleInPdf: group.event.ticketSlugVisibleInPdf,
        },
        instance,
      );
      return {
        ticket: {
          id: ticket.id,
          fullName: ticket.fullName,
          slug: ticket.slug,
          mail: ticket.mail,
          ticketType: {
            id: ticket.ticketType.id,
            name: ticket.ticketType.name,
          },
        },
        pdf: { blob },
      };
    }),
  );
}

/** Envía las entradas de un ticketGroup ya pagado y avisa al organizador del evento. */
export async function deliverPaidTicketGroup(
  db: Db,
  instance: ResolvedInstance,
  ticketGroupId: string,
) {
  const group = await db.query.ticketGroup.findFirst({
    where: eq(ticketGroup.id, ticketGroupId),
    columns: { id: true },
    with: {
      event: { columns: { id: true, name: true, emailNotification: true } },
    },
  });

  if (!group) {
    throw new Error('ticketGroup no encontrado');
  }

  const pdfs = await generateTicketGroupPdfs(db, instance, ticketGroupId);

  // De forma secuencial para evitar rate limits
  for (const pdf of pdfs) {
    await sendMailService(instance, {
      eventName: group.event.name,
      receiver: pdf.ticket.mail,
      subject: `¡Llegaron tus tickets para ${group.event.name}!`,
      body: generateTicketEmailBody(instance, group.event.name),
      attatchments: [pdf.pdf.blob],
    });
  }

  if (group.event.emailNotification) {
    await sendNotificationService(db, instance, {
      eventName: group.event.name,
      ticketGroupId: group.id,
      email: group.event.emailNotification,
    });
  }

  return { eventId: group.event.id, ticketCount: pdfs.length };
}
