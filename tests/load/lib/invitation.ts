import type { Pool } from 'pg';

import type { Db } from '@/drizzle';

import { updateTicketGroupStatus } from '@/server/services/ticketGroup';
import { buyerInput } from '@tests/load/lib/seed';
import { type callerFor } from '@tests/load/lib/caller';

type Caller = ReturnType<typeof callerFor>;

/**
 * Canje de un código de invitación con los mismos pasos que
 * /api/event/[slug]/invite + la server action de /checkout (evento gratis).
 */
export async function redeemInvitation(
  caller: Caller,
  db: Db,
  {
    eventId,
    slug,
    code,
    guestIndex,
    loadEventPage = true,
  }: {
    eventId: string;
    slug: string;
    code: string;
    guestIndex: number;
    loadEventPage?: boolean;
  },
) {
  if (loadEventPage) await caller.events.getPublicBySlug(slug);
  const validation = await caller.events.validateInvitationCode({
    eventId,
    code,
  });
  if (!validation.valid || !validation.organizerId) {
    return {
      status: validation.alreadyUsed ? 'code-used' : 'invalid',
    } as const;
  }
  const event = await caller.events.getById(eventId);
  const ticketType = event.ticketTypes.find((t) => t.name !== 'Organizador')!;
  const ticketGroupId = await caller.ticketGroup.create({
    eventId,
    ticketsPerType: [{ ticketTypeId: ticketType.id, amount: 1 }],
    invitedBy: validation.organizerId,
  });
  await caller.ticketGroup.updateTicketXOrganizerTicketGroupId({
    code,
    eventId,
    ticketGroupId,
  });

  // Checkout
  await caller.events.getById(eventId);
  await caller.ticketGroup.getTotalPriceById(ticketGroupId);
  await caller.emittedTickets.createMany([
    buyerInput(5_000_000 + guestIndex, ticketType.id, ticketGroupId, eventId),
  ]);
  await updateTicketGroupStatus(db, ticketGroupId, 'FREE');
  return {
    status: 'redeemed',
    ticketGroupId,
    organizerId: validation.organizerId,
  } as const;
}

/** Cupos asignados vs. códigos existentes, en total y por organizador. */
export async function invitationInvariants(raw: Pool, eventId: string) {
  const { rows } = await raw.query(
    `SELECT x."ticketAmount" AS assigned,
            (SELECT count(*)::int FROM "ticketXOrganizer" t
             WHERE t."eventId" = x."eventId" AND t."organizerId" = x."organizerId") AS codes
     FROM "eventXOrganizer" x
     WHERE x."eventId" = $1`,
    [eventId],
  );
  const totals = await raw.query(
    `SELECT (SELECT count(*)::int FROM "ticketXOrganizer" WHERE "eventId" = $1) AS codes,
            (SELECT coalesce(sum("ticketAmount"), 0)::int FROM "eventXOrganizer" WHERE "eventId" = $1) AS assigned,
            (SELECT count(*)::int FROM "ticketXOrganizer" WHERE "eventId" = $1 AND "ticketId" IS NOT NULL) AS "usedCodes"`,
    [eventId],
  );
  return {
    totals: totals.rows[0] as {
      codes: number;
      assigned: number;
      usedCodes: number;
    },
    organizersWithAssignedNotEqualCodes: rows.filter(
      (r) => r.assigned !== r.codes,
    ).length,
  };
}
