import { type RouterOutputs } from '@/server/routers/app';

type EventWithOrganizers = NonNullable<RouterOutputs['events']['getBySlug']>;
type EventOrganizer = EventWithOrganizers['eventXorganizers'][number];

export type OrganizerCardItem = {
  id: string;
  fullName: string;
  emittedCount: number;
  maxEmitible: number;
  emissionPercent: number;
  isChief?: boolean;
  filterInvitedByIds: string[];
};

export type OrganizerCardClickPayload = {
  searchLabel: string;
  invitedByIds: string[];
};

function countEmittedTicketsByOrganizer(
  event: EventWithOrganizers,
  organizerIds: string[],
) {
  const idSet = new Set(organizerIds);
  const counts = new Map<string, number>();

  event.ticketGroups.forEach((tg) => {
    if (tg.status === 'BOOKED' || !tg.invitedById) return;
    if (!idSet.has(tg.invitedById)) return;

    const ticketCount = tg.emittedTickets?.length ?? 0;
    counts.set(tg.invitedById, (counts.get(tg.invitedById) ?? 0) + ticketCount);
  });

  return counts;
}

export function getChiefTeamMemberIds(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
) {
  return event.eventXorganizers
    .filter(
      (eo) =>
        eo.user.id === chiefOrganizerId ||
        eo.user.chiefOrganizerId === chiefOrganizerId,
    )
    .map((eo) => eo.user.id);
}

function buildCardItem(
  id: string,
  fullName: string,
  maxEmitible: number,
  emittedCount: number,
  isChief = false,
  filterInvitedByIds?: string[],
): OrganizerCardItem {
  const emissionPercent =
    maxEmitible > 0 ? (emittedCount / maxEmitible) * 100 : 0;

  return {
    id,
    fullName,
    emittedCount,
    maxEmitible,
    emissionPercent,
    isChief,
    filterInvitedByIds: filterInvitedByIds ?? [id],
  };
}

function sumTicketAmounts(members: EventOrganizer[]) {
  return members.reduce((sum, eo) => sum + (eo.ticketAmount ?? 0), 0);
}

function sumEmittedForIds(
  emittedByOrganizer: Map<string, number>,
  organizerIds: string[],
) {
  return organizerIds.reduce(
    (sum, id) => sum + (emittedByOrganizer.get(id) ?? 0),
    0,
  );
}

/** Tarjetas de organizadores de un jefe (sin incluir al jefe). */
export function buildChiefTeamOrganizerCards(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
): OrganizerCardItem[] {
  const subordinates = event.eventXorganizers.filter(
    (eo) => eo.user.chiefOrganizerId === chiefOrganizerId,
  );

  if (subordinates.length === 0) return [];

  const organizerIds = subordinates.map((eo) => eo.user.id);
  const emittedByOrganizer = countEmittedTicketsByOrganizer(
    event,
    organizerIds,
  );

  return subordinates
    .map((eo) =>
      buildCardItem(
        eo.user.id,
        eo.user.fullName,
        eo.ticketAmount ?? 0,
        emittedByOrganizer.get(eo.user.id) ?? 0,
      ),
    )
    .sort((a, b) => b.emittedCount - a.emittedCount);
}

function buildAdminChiefCards(
  event: EventWithOrganizers,
  emittedByOrganizer: Map<string, number>,
): OrganizerCardItem[] {
  const chiefs = event.eventXorganizers.filter(
    (eo) => eo.user.role === 'CHIEF_ORGANIZER',
  );

  return chiefs
    .map((chief) => {
      const teamMembers = event.eventXorganizers.filter(
        (eo) =>
          eo.user.id === chief.user.id ||
          eo.user.chiefOrganizerId === chief.user.id,
      );
      const teamIds = teamMembers.map((eo) => eo.user.id);

      return buildCardItem(
        chief.user.id,
        chief.user.fullName,
        sumTicketAmounts(teamMembers),
        sumEmittedForIds(emittedByOrganizer, teamIds),
        true,
        teamIds,
      );
    })
    .sort((a, b) => b.emittedCount - a.emittedCount);
}

function buildAdminOrganizerMemberCards(
  event: EventWithOrganizers,
  emittedByOrganizer: Map<string, number>,
): OrganizerCardItem[] {
  return event.eventXorganizers
    .filter((eo) => eo.user.role === 'ORGANIZER')
    .map((eo) =>
      buildCardItem(
        eo.user.id,
        eo.user.fullName,
        eo.ticketAmount ?? 0,
        emittedByOrganizer.get(eo.user.id) ?? 0,
      ),
    )
    .sort((a, b) => b.emittedCount - a.emittedCount);
}

/** Admin: jefes (totales del equipo) primero, luego todos los organizadores. */
export function buildAdminOrganizerCards(
  event: EventWithOrganizers,
): OrganizerCardItem[] {
  const allOrganizerIds = event.eventXorganizers.map((eo) => eo.user.id);
  const emittedByOrganizer = countEmittedTicketsByOrganizer(
    event,
    allOrganizerIds,
  );

  const chiefCards = buildAdminChiefCards(event, emittedByOrganizer);
  const organizerCards = buildAdminOrganizerMemberCards(
    event,
    emittedByOrganizer,
  );

  return [...chiefCards, ...organizerCards];
}
