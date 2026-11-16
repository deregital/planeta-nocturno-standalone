import 'server-only';

import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import {
  deletedEmittedTicket,
  type DeletedTicketInvitationSnapshot,
  emittedTicket,
  emittedTicketScan,
  ticketGroup,
  ticketType as ticketTypeTable,
  ticketTypePerGroup,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { allocateEmittedTicketShortIds } from '@/server/utils/emittedTicketShortId';

/**
 * Papelera de entradas. Una entrada eliminada sale de `emittedTicket` (así
 * deja de escanearse y de figurar en tablas, estadísticas y exportaciones,
 * igual que antes cuando se borraba) y queda en `deletedEmittedTicket` con el
 * motivo. Además libera su lugar en el cupo (`ticketTypePerGroup.amount`) y en
 * el total de la compra (`ticketGroup.amountTickets`). Restaurarla hace lo
 * inverso, con el mismo id: el QR que tiene la persona vuelve a valer.
 */

export const DELETION_REASON_MAX_LENGTH = 500;

export async function moveTicketToTrash(
  db: Db,
  {
    ticketId,
    reason,
    deletedByUserId,
  }: { ticketId: string; reason: string; deletedByUserId: string },
) {
  return db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(emittedTicket)
      .where(eq(emittedTicket.id, ticketId))
      .for('update');
    if (!ticket) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'La entrada no existe o ya está en la papelera',
      });
    }

    const [scans, [invitation]] = await Promise.all([
      tx
        .select({
          id: emittedTicketScan.id,
          scannedAt: emittedTicketScan.scannedAt,
          scannedByUserId: emittedTicketScan.scannedByUserId,
        })
        .from(emittedTicketScan)
        .where(eq(emittedTicketScan.emittedTicketId, ticketId)),
      tx
        .select({
          organizerId: ticketXorganizer.organizerId,
          ticketGroupId: ticketXorganizer.ticketGroupId,
          code: ticketXorganizer.code,
          shortId: ticketXorganizer.shortId,
          createdAt: ticketXorganizer.createdAt,
          shared: ticketXorganizer.shared,
          sharedWith: ticketXorganizer.sharedWith,
        })
        .from(ticketXorganizer)
        .where(eq(ticketXorganizer.ticketId, ticketId))
        .limit(1),
    ]);

    await tx.insert(deletedEmittedTicket).values({
      ...ticket,
      scans,
      invitation: (invitation ??
        null) as DeletedTicketInvitationSnapshot | null,
      deletionReason: reason,
      deletedByUserId,
    });

    // Los escaneos y el código de invitación se borran en cascada (como
    // antes): quedan guardados en la papelera para restaurarlos.
    await tx.delete(emittedTicket).where(eq(emittedTicket.id, ticketId));

    await tx
      .update(ticketTypePerGroup)
      .set({ amount: sql`greatest(${ticketTypePerGroup.amount} - 1, 0)` })
      .where(
        and(
          eq(ticketTypePerGroup.ticketGroupId, ticket.ticketGroupId),
          eq(ticketTypePerGroup.ticketTypeId, ticket.ticketTypeId),
        ),
      );
    await tx
      .update(ticketGroup)
      .set({
        amountTickets: sql`greatest(${ticketGroup.amountTickets} - 1, 0)`,
      })
      .where(eq(ticketGroup.id, ticket.ticketGroupId));

    return { id: ticket.id, eventId: ticket.eventId };
  });
}

export async function restoreTicketFromTrash(db: Db, ticketId: string) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .select()
      .from(deletedEmittedTicket)
      .where(eq(deletedEmittedTicket.id, ticketId))
      .for('update');
    if (!deleted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'La entrada ya no está en la papelera',
      });
    }

    // Mismo control de cupo que al emitir, con el tipo bloqueado para que dos
    // restauraciones o emisiones a la vez no lo pasen juntas.
    const [type] = await tx
      .select()
      .from(ticketTypeTable)
      .where(eq(ticketTypeTable.id, deleted.ticketTypeId))
      .for('update');
    if (type && type.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim()) {
      const [taken] = await tx
        .select({
          amount: sql<number>`coalesce(sum(${ticketTypePerGroup.amount}), 0)::int`,
        })
        .from(ticketTypePerGroup)
        .where(eq(ticketTypePerGroup.ticketTypeId, type.id));
      if (Number(taken?.amount ?? 0) + 1 > type.maxAvailable) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `No queda cupo de ${type.name} (cupo ${type.maxAvailable}) para restaurar la entrada.`,
        });
      }
    }

    // El número corto pudo quedar tomado por una entrada emitida después.
    const [shortIdTaken] = await tx
      .select({ id: emittedTicket.id })
      .from(emittedTicket)
      .where(
        and(
          eq(emittedTicket.eventId, deleted.eventId),
          eq(emittedTicket.shortId, deleted.shortId),
        ),
      )
      .limit(1);
    const shortId = shortIdTaken
      ? (await allocateEmittedTicketShortIds(tx, deleted.eventId, 1))[0]!
      : deleted.shortId;

    // Un usuario borrado mientras tanto no puede quedar como quien escaneó.
    const userIds = [
      deleted.scannedByUserId,
      ...deleted.scans.map((scan) => scan.scannedByUserId),
    ].filter((id): id is string => !!id);
    const existingUsers = new Set(
      userIds.length === 0
        ? []
        : (
            await tx
              .select({ id: user.id })
              .from(user)
              .where(inArray(user.id, [...new Set(userIds)]))
          ).map((row) => row.id),
    );
    const userOrNull = (id: string | null) =>
      id && existingUsers.has(id) ? id : null;

    await tx.insert(emittedTicket).values({
      id: deleted.id,
      fullName: deleted.fullName,
      dni: deleted.dni,
      mail: deleted.mail,
      gender: deleted.gender,
      phoneNumber: deleted.phoneNumber,
      instagram: deleted.instagram,
      birthDate: deleted.birthDate,
      slug: deleted.slug,
      paidOnLocation: deleted.paidOnLocation,
      scanned: deleted.scanned,
      scannedAt: deleted.scannedAt,
      scannedByUserId: userOrNull(deleted.scannedByUserId),
      ticketTypeId: deleted.ticketTypeId,
      ticketGroupId: deleted.ticketGroupId,
      eventId: deleted.eventId,
      shortId,
      createdAt: deleted.createdAt,
    });

    if (deleted.scans.length > 0) {
      await tx
        .insert(emittedTicketScan)
        .values(
          deleted.scans.map((scan) => ({
            id: scan.id,
            emittedTicketId: deleted.id,
            scannedAt: scan.scannedAt,
            scannedByUserId: userOrNull(scan.scannedByUserId),
          })),
        )
        .onConflictDoNothing();
    }

    if (deleted.invitation) {
      const invitation = deleted.invitation;
      const [organizerExists] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, invitation.organizerId))
        .limit(1);
      // Si el número de la invitación ya se usó para otra, la entrada vuelve
      // sin código de invitación.
      if (organizerExists) {
        await tx
          .insert(ticketXorganizer)
          .values({
            ticketId: deleted.id,
            organizerId: invitation.organizerId,
            ticketGroupId: invitation.ticketGroupId,
            eventId: deleted.eventId,
            code: invitation.code,
            shortId: invitation.shortId,
            createdAt: invitation.createdAt,
            shared: invitation.shared,
            sharedWith: invitation.sharedWith,
          })
          .onConflictDoNothing();
      }
    }

    await tx
      .insert(ticketTypePerGroup)
      .values({
        ticketTypeId: deleted.ticketTypeId,
        ticketGroupId: deleted.ticketGroupId,
        amount: 1,
      })
      .onConflictDoUpdate({
        target: [
          ticketTypePerGroup.ticketTypeId,
          ticketTypePerGroup.ticketGroupId,
        ],
        set: { amount: sql`${ticketTypePerGroup.amount} + 1` },
      });
    await tx
      .update(ticketGroup)
      .set({ amountTickets: sql`${ticketGroup.amountTickets} + 1` })
      .where(eq(ticketGroup.id, deleted.ticketGroupId));

    await tx
      .delete(deletedEmittedTicket)
      .where(eq(deletedEmittedTicket.id, deleted.id));

    return { id: deleted.id, eventId: deleted.eventId, shortId };
  });
}

/** Entradas en la papelera de un evento, la última eliminada primero. */
export async function listTrashedTickets(db: Db, eventId: string) {
  return db
    .select({
      id: deletedEmittedTicket.id,
      fullName: deletedEmittedTicket.fullName,
      dni: deletedEmittedTicket.dni,
      mail: deletedEmittedTicket.mail,
      shortId: deletedEmittedTicket.shortId,
      scanned: deletedEmittedTicket.scanned,
      createdAt: deletedEmittedTicket.createdAt,
      ticketTypeName: ticketTypeTable.name,
      deletionReason: deletedEmittedTicket.deletionReason,
      deletedAt: deletedEmittedTicket.deletedAt,
      deletedByName: user.fullName,
    })
    .from(deletedEmittedTicket)
    .leftJoin(
      ticketTypeTable,
      eq(ticketTypeTable.id, deletedEmittedTicket.ticketTypeId),
    )
    .leftJoin(user, eq(user.id, deletedEmittedTicket.deletedByUserId))
    .where(eq(deletedEmittedTicket.eventId, eventId))
    .orderBy(desc(deletedEmittedTicket.deletedAt));
}

/**
 * Entrada en la papelera de uno de estos eventos, para que la puerta vea por
 * qué no vale. Null si no está (o es de otro evento).
 */
export async function findTrashedTicket(
  db: Pick<Db, 'select'>,
  ticketId: string,
  eventIds: readonly string[],
) {
  if (eventIds.length === 0) return null;
  const [row] = await db
    .select({
      id: deletedEmittedTicket.id,
      eventId: deletedEmittedTicket.eventId,
      fullName: deletedEmittedTicket.fullName,
      deletionReason: deletedEmittedTicket.deletionReason,
    })
    .from(deletedEmittedTicket)
    .where(
      and(
        eq(deletedEmittedTicket.id, ticketId),
        inArray(deletedEmittedTicket.eventId, [...eventIds]),
      ),
    )
    .limit(1);
  return row ?? null;
}
