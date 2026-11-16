import 'server-only';

import { TRPCError } from '@trpc/server';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import {
  deletedEmittedTicket,
  type DeletedTicketInvitationSnapshot,
  emittedTicket,
  emittedTicketScan,
  eventXorganizer,
  ticketGroup,
  ticketType as ticketTypeTable,
  ticketTypePerGroup,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { allocateEmittedTicketShortIds } from '@/server/utils/emittedTicketShortId';
import {
  allocateTicketXOrganizerShortIds,
  insertInvitationCodes,
} from '@/server/utils/ticketXOrganizerInvite';

/**
 * Papelera de entradas. Una entrada eliminada sale de `emittedTicket` (así
 * deja de escanearse y de figurar en tablas, estadísticas y exportaciones,
 * igual que antes cuando se borraba) y queda en `deletedEmittedTicket` con el
 * motivo. Además libera su lugar en el cupo (`ticketTypePerGroup.amount`) y en
 * el total de la compra (`ticketGroup.amountTickets`). Restaurarla hace lo
 * inverso, con el mismo id: el QR que tiene la persona vuelve a valer.
 *
 * En un evento por invitación el código usado queda anulado (su link ya no
 * sirve) y el organizador recibe uno nuevo sin usar, así conserva su cantidad.
 * Al restaurar se le saca un código sin usar ni compartir (primero ese) o, si
 * no tiene, hace falta que le sobre lugar.
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

    // Los escaneos y el código de invitación se borran en cascada: quedan
    // guardados en la papelera para restaurarlos. El código usado queda
    // anulado (su link ya no sirve) y el organizador recibe uno nuevo sin
    // usar, así no pierde la invitación.
    await tx.delete(emittedTicket).where(eq(emittedTicket.id, ticketId));

    const replacementCode = invitation
      ? await addReplacementInvitationCode(
          tx,
          ticket.eventId,
          invitation.organizerId,
        )
      : null;

    await tx.insert(deletedEmittedTicket).values({
      ...ticket,
      scans,
      invitation: invitation
        ? ({
            ...invitation,
            replacementCode,
          } as DeletedTicketInvitationSnapshot)
        : null,
      deletionReason: reason,
      deletedByUserId,
    });

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

    // Invitación: el cupo es el de códigos del organizador. Se le saca un
    // código sin usar ni compartir (el que recibió al eliminarla, si sigue
    // así) o, si no tiene, tiene que sobrarle lugar.
    const restoreInvitation = deleted.invitation
      ? await freeInvitationSlot(tx, deleted.eventId, deleted.invitation)
      : false;

    // Mismo control de cupo que al emitir, con el tipo bloqueado para que dos
    // restauraciones o emisiones a la vez no lo pasen juntas.
    const [type] = await tx
      .select()
      .from(ticketTypeTable)
      .where(eq(ticketTypeTable.id, deleted.ticketTypeId))
      .for('update');
    if (
      !deleted.invitation &&
      type &&
      type.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim()
    ) {
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

    if (deleted.invitation && restoreInvitation) {
      const invitation = deleted.invitation;
      // El número de la invitación pudo quedar tomado por un código nuevo.
      const [invitationShortIdTaken] = await tx
        .select({ code: ticketXorganizer.code })
        .from(ticketXorganizer)
        .where(
          and(
            eq(ticketXorganizer.eventId, deleted.eventId),
            eq(ticketXorganizer.shortId, invitation.shortId),
          ),
        )
        .limit(1);
      const invitationShortId = invitationShortIdTaken
        ? (await allocateTicketXOrganizerShortIds(tx, deleted.eventId, 1))[0]!
        : invitation.shortId;
      await tx
        .insert(ticketXorganizer)
        .values({
          ticketId: deleted.id,
          organizerId: invitation.organizerId,
          ticketGroupId: invitation.ticketGroupId,
          eventId: deleted.eventId,
          code: invitation.code,
          shortId: invitationShortId,
          createdAt: invitation.createdAt,
          shared: invitation.shared,
          sharedWith: invitation.sharedWith,
        })
        .onConflictDoNothing();
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

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Código nuevo sin usar para el organizador, en su grupo de invitaciones (el
 * FREE donde están sus códigos sin usar; si no le queda ninguno, uno nuevo,
 * igual que al subirle la cantidad desde el evento). Null si el organizador
 * ya no está en el evento.
 */
async function addReplacementInvitationCode(
  tx: Tx,
  eventId: string,
  organizerId: string,
): Promise<string | null> {
  const [assigned] = await tx
    .select({ organizerId: eventXorganizer.organizerId })
    .from(eventXorganizer)
    .where(
      and(
        eq(eventXorganizer.eventId, eventId),
        eq(eventXorganizer.organizerId, organizerId),
      ),
    )
    .limit(1);
  if (!assigned) return null;

  const [existingGroup] = await tx
    .select({ id: ticketGroup.id })
    .from(ticketXorganizer)
    .innerJoin(ticketGroup, eq(ticketGroup.id, ticketXorganizer.ticketGroupId))
    .where(
      and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.organizerId, organizerId),
        isNull(ticketXorganizer.ticketId),
        eq(ticketGroup.status, 'FREE'),
      ),
    )
    .limit(1);

  let groupId: string;
  if (existingGroup) {
    groupId = existingGroup.id;
    await tx
      .update(ticketGroup)
      .set({ amountTickets: sql`${ticketGroup.amountTickets} + 1` })
      .where(eq(ticketGroup.id, groupId));
  } else {
    const [created] = await tx
      .insert(ticketGroup)
      .values({ eventId, status: 'FREE', amountTickets: 1 })
      .returning({ id: ticketGroup.id });
    groupId = created.id;
  }

  const [shortId] = await allocateTicketXOrganizerShortIds(tx, eventId, 1);
  await insertInvitationCodes(tx, [
    { eventId, organizerId, ticketGroupId: groupId, shortId: shortId! },
  ]);
  const [row] = await tx
    .select({ code: ticketXorganizer.code })
    .from(ticketXorganizer)
    .where(
      and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.shortId, shortId!),
      ),
    )
    .limit(1);
  return row?.code ?? null;
}

/**
 * Hace lugar para que vuelva el código de una entrada de invitación. Saca un
 * código sin usar ni compartir del organizador (primero el que recibió al
 * eliminarla) que no esté en medio de una compra; si no tiene, alcanza con que
 * le sobre lugar en su cantidad. Devuelve false si el código no tiene que
 * volver (el organizador ya no está o no existe).
 */
async function freeInvitationSlot(
  tx: Tx,
  eventId: string,
  invitation: DeletedTicketInvitationSnapshot,
): Promise<boolean> {
  const [assignment] = await tx
    .select({
      ticketAmount: eventXorganizer.ticketAmount,
      fullName: user.fullName,
    })
    .from(eventXorganizer)
    .innerJoin(user, eq(user.id, eventXorganizer.organizerId))
    .where(
      and(
        eq(eventXorganizer.eventId, eventId),
        eq(eventXorganizer.organizerId, invitation.organizerId),
      ),
    )
    .limit(1);
  // Ya no está en el evento: la entrada vuelve sin código de invitación.
  if (!assignment) return false;

  const candidates = await tx
    .select({
      code: ticketXorganizer.code,
      ticketGroupId: ticketXorganizer.ticketGroupId,
    })
    .from(ticketXorganizer)
    .innerJoin(ticketGroup, eq(ticketGroup.id, ticketXorganizer.ticketGroupId))
    .where(
      and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.organizerId, invitation.organizerId),
        isNull(ticketXorganizer.ticketId),
        eq(ticketXorganizer.shared, false),
        // Un código en medio de una compra apunta a la reserva (BOOKED).
        eq(ticketGroup.status, 'FREE'),
      ),
    )
    .orderBy(asc(ticketXorganizer.createdAt));

  const pick =
    candidates.find((c) => c.code === invitation.replacementCode) ??
    candidates[0];
  if (pick) {
    await tx
      .delete(ticketXorganizer)
      .where(
        and(
          eq(ticketXorganizer.eventId, eventId),
          eq(ticketXorganizer.code, pick.code),
        ),
      );
    if (pick.ticketGroupId) {
      await tx
        .update(ticketGroup)
        .set({
          amountTickets: sql`greatest(${ticketGroup.amountTickets} - 1, 0)`,
        })
        .where(eq(ticketGroup.id, pick.ticketGroupId));
    }
    return true;
  }

  const [{ total }] = await tx
    .select({ total: count() })
    .from(ticketXorganizer)
    .where(
      and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.organizerId, invitation.organizerId),
      ),
    );
  if (Number(total) + 1 > (assignment.ticketAmount ?? 0)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `${assignment.fullName} ya usó o compartió todas sus invitaciones. Subile la cantidad en el evento para restaurar esta entrada.`,
    });
  }
  return true;
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
