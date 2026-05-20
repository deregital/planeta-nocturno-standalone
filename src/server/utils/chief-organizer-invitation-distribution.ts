import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray, isNull, not } from 'drizzle-orm';

import { type Db } from '@/drizzle';

import {
  emittedTicket,
  event as eventSchema,
  eventXorganizer,
  ticketGroup,
  ticketType,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { type OrganizerInvitationSchema } from '@/server/schemas/organizer';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';
import { allocateTicketXOrganizerShortIds } from '@/server/utils/ticketXOrganizerInvite';
import { generateSlug } from '@/server/utils/utils';

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

function getTicketAmount(organizer: OrganizerInvitationSchema) {
  return organizer.ticketAmount ?? 0;
}

function validateChiefTicketPool(pool: number, assignedTickets: number) {
  if (assignedTickets > pool) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `La distribución excede el total de ${pool} tickets de tu equipo.`,
    });
  }
}

function isChiefTeamMember(
  organizerId: string,
  chiefOrganizerId: string,
  subordinateIds: Set<string>,
) {
  return organizerId === chiefOrganizerId || subordinateIds.has(organizerId);
}

function getChiefTeamAssignedTotal(
  organizersDB: { organizerId: string; ticketAmount: number | null }[],
  chiefOrganizerId: string,
  subordinateIds: Set<string>,
  organizersInput: OrganizerInvitationSchema[],
  deletedOrganizersIds: string[],
) {
  let total = 0;

  for (const org of organizersDB) {
    if (!isChiefTeamMember(org.organizerId, chiefOrganizerId, subordinateIds)) {
      continue;
    }
    if (deletedOrganizersIds.includes(org.organizerId)) continue;

    const input = organizersInput.find((o) => o.id === org.organizerId);
    total += input ? getTicketAmount(input) : (org.ticketAmount ?? 0);
  }

  for (const organizer of organizersInput) {
    if (!organizersDB.some((org) => org.organizerId === organizer.id)) {
      total += getTicketAmount(organizer);
    }
  }

  return total;
}

async function buildOrganizerTicketCounts(
  tx: Transaction,
  eventId: string,
  organizersDB: { organizerId: string }[],
) {
  const organizerTicketCounts = new Map<string, number>();

  for (const org of organizersDB) {
    const ticketXOrgCount = await tx.query.ticketXorganizer.findMany({
      where: and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.organizerId, org.organizerId),
      ),
    });
    organizerTicketCounts.set(org.organizerId, ticketXOrgCount.length);
  }

  return organizerTicketCounts;
}

async function deleteChiefOrganizersFromEvent(
  tx: Transaction,
  eventId: string,
  deletedOrganizersIds: string[],
  currentOrganizerGroup: { id: string; amountTickets: number } | null,
) {
  if (deletedOrganizersIds.length === 0) return;

  const ticketTypesDB = await tx.query.ticketType.findMany({
    where: eq(ticketType.eventId, eventId),
  });

  const organizerTicketType = ticketTypesDB.find(
    (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
  );

  const deletedOrganizers = await tx.query.user.findMany({
    where: inArray(user.id, deletedOrganizersIds),
    columns: { id: true, dni: true },
  });

  const ticketGroupsToUpdate = new Map<string, number>();

  for (const organizerId of deletedOrganizersIds) {
    const ticketXOrgsToDelete = await tx.query.ticketXorganizer.findMany({
      where: and(
        eq(ticketXorganizer.eventId, eventId),
        eq(ticketXorganizer.organizerId, organizerId),
        isNull(ticketXorganizer.ticketId),
      ),
    });

    for (const ticketXOrg of ticketXOrgsToDelete) {
      if (ticketXOrg.ticketGroupId) {
        const currentCount =
          ticketGroupsToUpdate.get(ticketXOrg.ticketGroupId) || 0;
        ticketGroupsToUpdate.set(ticketXOrg.ticketGroupId, currentCount + 1);
      }
    }

    await tx
      .delete(ticketXorganizer)
      .where(
        and(
          eq(ticketXorganizer.eventId, eventId),
          eq(ticketXorganizer.organizerId, organizerId),
          isNull(ticketXorganizer.ticketId),
        ),
      );
  }

  for (const [ticketGroupId, deletedCount] of ticketGroupsToUpdate.entries()) {
    const group = await tx.query.ticketGroup.findFirst({
      where: eq(ticketGroup.id, ticketGroupId),
    });

    if (group) {
      await tx
        .update(ticketGroup)
        .set({
          amountTickets: Math.max(0, group.amountTickets - deletedCount),
        })
        .where(eq(ticketGroup.id, ticketGroupId));
    }
  }

  if (organizerTicketType && currentOrganizerGroup) {
    for (const deletedOrg of deletedOrganizers) {
      const organizerEmittedTicket = await tx.query.emittedTicket.findFirst({
        where: and(
          eq(emittedTicket.eventId, eventId),
          eq(emittedTicket.dni, deletedOrg.dni),
          eq(emittedTicket.ticketTypeId, organizerTicketType.id),
          eq(emittedTicket.ticketGroupId, currentOrganizerGroup.id),
        ),
      });

      if (organizerEmittedTicket) {
        await tx
          .delete(emittedTicket)
          .where(eq(emittedTicket.id, organizerEmittedTicket.id));
      }
    }

    await tx
      .update(ticketGroup)
      .set({
        amountTickets: Math.max(
          0,
          (currentOrganizerGroup.amountTickets ?? 0) - deletedOrganizers.length,
        ),
      })
      .where(eq(ticketGroup.id, currentOrganizerGroup.id));
  }

  await tx
    .delete(eventXorganizer)
    .where(
      and(
        eq(eventXorganizer.eventId, eventId),
        inArray(eventXorganizer.organizerId, deletedOrganizersIds),
      ),
    );
}

async function addChiefOrganizerToEvent(
  tx: Transaction,
  event: {
    id: string;
    startingDate: string;
    name: string;
    ticketSlugVisibleInPdf: boolean;
  },
  organizerInput: OrganizerInvitationSchema,
  organizersDBCount: number,
  currentOrganizerGroup: { id: string; amountTickets: number },
  organizerTicketType: { id: string; startingDate: string; name: string },
) {
  const ticketAmount = getTicketAmount(organizerInput);
  const org = await tx.query.user.findFirst({
    where: eq(user.id, organizerInput.id),
  });

  if (!org) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Organizador no encontrado',
    });
  }

  await tx.insert(eventXorganizer).values({
    eventId: event.id,
    organizerId: organizerInput.id,
    discountPercentage: null,
    ticketAmount,
  });

  const [updatedTicketGroup] = await tx
    .update(ticketGroup)
    .set({
      amountTickets: currentOrganizerGroup.amountTickets + 1,
    })
    .where(eq(ticketGroup.id, currentOrganizerGroup.id))
    .returning();

  await tx.insert(emittedTicket).values({
    fullName: org.fullName,
    dni: org.dni,
    mail: org.email,
    gender: org.gender,
    phoneNumber: org.phoneNumber,
    birthDate: org.birthDate,
    instagram: org.instagram,
    slug: generateSlug(`${ORGANIZER_TICKET_TYPE_NAME} ${organizersDBCount}`),
    ticketTypeId: organizerTicketType.id,
    ticketGroupId: updatedTicketGroup.id,
    eventId: event.id,
  });

  if (ticketAmount > 0) {
    const [thisOrganizerTicketGroup] = await tx
      .insert(ticketGroup)
      .values({
        eventId: event.id,
        status: 'FREE',
        amountTickets: ticketAmount,
      })
      .returning();

    const shortIds = await allocateTicketXOrganizerShortIds(
      tx,
      event.id,
      ticketAmount,
    );

    await tx.insert(ticketXorganizer).values(
      Array.from({ length: ticketAmount }).map((_, i) => ({
        eventId: event.id,
        organizerId: organizerInput.id,
        ticketGroupId: thisOrganizerTicketGroup.id,
        shortId: shortIds[i]!,
      })),
    );
  }
}

async function updateChiefOrganizerTicketAmount(
  tx: Transaction,
  eventId: string,
  organizerInput: OrganizerInvitationSchema,
  organizerTicketCounts: Map<string, number>,
) {
  const newTicketAmount = getTicketAmount(organizerInput);
  const currentTicketAmount = organizerTicketCounts.get(organizerInput.id) ?? 0;

  if (newTicketAmount === currentTicketAmount) return;

  const usedTickets = await tx.query.ticketXorganizer.findMany({
    where: and(
      eq(ticketXorganizer.eventId, eventId),
      eq(ticketXorganizer.organizerId, organizerInput.id),
      not(isNull(ticketXorganizer.ticketId)),
    ),
  });

  const usedTicketsCount = usedTickets.length;

  if (newTicketAmount < usedTicketsCount) {
    const organizerUser = await tx.query.user.findFirst({
      where: eq(user.id, organizerInput.id),
      columns: { fullName: true },
    });

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `No se puede reducir la cantidad de tickets del organizador ${organizerUser?.fullName || organizerInput.id} a ${newTicketAmount} porque ya se han emitido ${usedTicketsCount} tickets. La cantidad mínima permitida es ${usedTicketsCount}.`,
    });
  }

  await tx
    .update(eventXorganizer)
    .set({ ticketAmount: newTicketAmount })
    .where(
      and(
        eq(eventXorganizer.eventId, eventId),
        eq(eventXorganizer.organizerId, organizerInput.id),
      ),
    );

  const existingTicketXOrganizers = await tx.query.ticketXorganizer.findMany({
    where: and(
      eq(ticketXorganizer.eventId, eventId),
      eq(ticketXorganizer.organizerId, organizerInput.id),
      isNull(ticketXorganizer.ticketId),
    ),
    orderBy: [asc(ticketXorganizer.createdAt)],
  });

  const difference = newTicketAmount - currentTicketAmount;

  if (difference < 0) {
    const toDelete = existingTicketXOrganizers.slice(0, Math.abs(difference));
    const ticketGroupsToUpdate = new Map<string, number>();

    for (const ticketXOrg of toDelete) {
      if (ticketXOrg.ticketGroupId) {
        const currentCount =
          ticketGroupsToUpdate.get(ticketXOrg.ticketGroupId) || 0;
        ticketGroupsToUpdate.set(ticketXOrg.ticketGroupId, currentCount + 1);
      }

      await tx
        .delete(ticketXorganizer)
        .where(
          and(
            eq(ticketXorganizer.eventId, eventId),
            eq(ticketXorganizer.code, ticketXOrg.code),
          ),
        );
    }

    for (const [
      ticketGroupId,
      deletedCount,
    ] of ticketGroupsToUpdate.entries()) {
      const group = await tx.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, ticketGroupId),
      });

      if (group) {
        await tx
          .update(ticketGroup)
          .set({
            amountTickets: Math.max(0, group.amountTickets - deletedCount),
          })
          .where(eq(ticketGroup.id, ticketGroupId));
      }
    }
  } else if (difference > 0) {
    const existingTicketXOrg = existingTicketXOrganizers[0];
    let organizerTicketGroup;

    if (existingTicketXOrg?.ticketGroupId) {
      organizerTicketGroup = await tx.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, existingTicketXOrg.ticketGroupId),
      });

      if (organizerTicketGroup) {
        await tx
          .update(ticketGroup)
          .set({
            amountTickets: organizerTicketGroup.amountTickets + difference,
          })
          .where(eq(ticketGroup.id, organizerTicketGroup.id));
      }
    }

    if (!organizerTicketGroup) {
      const [newTicketGroup] = await tx
        .insert(ticketGroup)
        .values({
          eventId,
          status: 'FREE',
          amountTickets: difference,
        })
        .returning();
      organizerTicketGroup = newTicketGroup;
    }

    const shortIds = await allocateTicketXOrganizerShortIds(
      tx,
      eventId,
      difference,
    );

    await tx.insert(ticketXorganizer).values(
      Array.from({ length: difference }).map((_, i) => ({
        eventId,
        organizerId: organizerInput.id,
        ticketGroupId: organizerTicketGroup!.id,
        shortId: shortIds[i]!,
      })),
    );
  }

  organizerTicketCounts.set(organizerInput.id, newTicketAmount);
}

export async function applyChiefOrganizerInvitationDistribution(
  db: Db,
  {
    chiefOrganizerId,
    eventId,
    organizersInput,
  }: {
    chiefOrganizerId: string;
    eventId: string;
    organizersInput: OrganizerInvitationSchema[];
  },
) {
  const subordinateUsers = await db.query.user.findMany({
    where: eq(user.chiefOrganizerId, chiefOrganizerId),
    columns: { id: true },
  });
  const subordinateIds = new Set(subordinateUsers.map((u) => u.id));

  for (const organizer of organizersInput) {
    if (!isChiefTeamMember(organizer.id, chiefOrganizerId, subordinateIds)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Solo podés gestionar tu equipo o tu propia asignación.',
      });
    }
  }

  const event = await db.query.event.findFirst({
    where: eq(eventSchema.id, eventId),
  });

  if (!event) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Evento no encontrado' });
  }

  if (event.inviteCondition !== 'INVITATION') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Este evento no utiliza invitaciones.',
    });
  }

  const chiefOnEvent = await db.query.eventXorganizer.findFirst({
    where: and(
      eq(eventXorganizer.eventId, eventId),
      eq(eventXorganizer.organizerId, chiefOrganizerId),
    ),
  });

  if (!chiefOnEvent) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No tenés acceso a este evento.',
    });
  }

  const organizersDB = await db.query.eventXorganizer.findMany({
    where: eq(eventXorganizer.eventId, eventId),
  });

  const chiefTeamOnEvent = organizersDB.filter((org) =>
    isChiefTeamMember(org.organizerId, chiefOrganizerId, subordinateIds),
  );

  const deletedOrganizersIds = chiefTeamOnEvent
    .filter(
      (org) =>
        org.organizerId !== chiefOrganizerId &&
        !organizersInput.some((o) => o.id === org.organizerId),
    )
    .map((org) => org.organizerId);

  const distributablePool = chiefTeamOnEvent.reduce(
    (sum, org) => sum + (org.ticketAmount ?? 0),
    0,
  );

  const teamAssignedTotal = getChiefTeamAssignedTotal(
    organizersDB,
    chiefOrganizerId,
    subordinateIds,
    organizersInput,
    deletedOrganizersIds,
  );

  validateChiefTicketPool(distributablePool, teamAssignedTotal);

  await db.transaction(async (tx) => {
    let currentOrganizerGroup = await tx.query.ticketGroup.findFirst({
      where: and(
        eq(ticketGroup.eventId, eventId),
        eq(ticketGroup.isOrganizerGroup, true),
      ),
    });

    if (!currentOrganizerGroup) {
      const [createdGroup] = await tx
        .insert(ticketGroup)
        .values({
          eventId,
          status: 'FREE',
          amountTickets: 0,
          isOrganizerGroup: true,
        })
        .returning();
      currentOrganizerGroup = createdGroup;
    }

    await deleteChiefOrganizersFromEvent(
      tx,
      eventId,
      deletedOrganizersIds,
      currentOrganizerGroup,
    );

    const organizersDBAfterDelete = await tx.query.eventXorganizer.findMany({
      where: eq(eventXorganizer.eventId, eventId),
    });

    await buildOrganizerTicketCounts(tx, eventId, organizersDBAfterDelete);

    const ticketTypesDB = await tx.query.ticketType.findMany({
      where: eq(ticketType.eventId, eventId),
    });

    let organizerTicketType = ticketTypesDB.find(
      (tt) => tt.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
    );

    if (!organizerTicketType) {
      const [createdOrganizerTicketType] = await tx
        .insert(ticketType)
        .values({
          name: ORGANIZER_TICKET_TYPE_NAME,
          description: 'Tickets para los organizadores',
          price: 0,
          maxAvailable: organizersInput.length,
          maxPerPurchase: 1,
          category: 'FREE',
          lowStockThreshold: null,
          maxSellDate: null,
          scanLimit: null,
          visibleInWeb: false,
          slug: generateSlug(ORGANIZER_TICKET_TYPE_NAME),
          eventId,
          startingDate: event.startingDate,
          sortOrder:
            Math.max(...ticketTypesDB.map((tt) => tt.sortOrder), 0) + 1,
        })
        .returning();
      organizerTicketType = createdOrganizerTicketType;
    }

    const addedOrganizersIds = organizersInput
      .filter(
        (o) => !organizersDBAfterDelete.some((org) => org.organizerId === o.id),
      )
      .map((o) => o.id);

    for (const addedOrganizerId of addedOrganizersIds) {
      const organizerInput = organizersInput.find(
        (o) => o.id === addedOrganizerId,
      );
      if (!organizerInput) continue;

      await addChiefOrganizerToEvent(
        tx,
        event,
        organizerInput,
        organizersDBAfterDelete.length +
          addedOrganizersIds.indexOf(addedOrganizerId),
        currentOrganizerGroup,
        organizerTicketType,
      );
    }

    const organizersDBFinal = await tx.query.eventXorganizer.findMany({
      where: eq(eventXorganizer.eventId, eventId),
    });

    const finalTicketCounts = await buildOrganizerTicketCounts(
      tx,
      eventId,
      organizersDBFinal,
    );

    for (const organizerInput of organizersInput) {
      const existsOnEvent = organizersDBFinal.some(
        (org) => org.organizerId === organizerInput.id,
      );
      if (!existsOnEvent) continue;

      await updateChiefOrganizerTicketAmount(
        tx,
        eventId,
        organizerInput,
        finalTicketCounts,
      );
    }
  });
}
