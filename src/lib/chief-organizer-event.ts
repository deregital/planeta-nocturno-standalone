import {
  mapEventOrganizersToSchema,
  type OrganizerTicketTypeRef,
} from '@/lib/event-organizers';
import { type RouterOutputs } from '@/server/routers/app';
import { type OrganizerSchema } from '@/server/schemas/organizer';
import { type InviteCondition } from '@/server/types';

type EventWithOrganizers = NonNullable<RouterOutputs['events']['getBySlug']>;

export function getChiefSubordinateOrganizerIds(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
) {
  return event.eventXorganizers
    .filter((eo) => eo.user.chiefOrganizerId === chiefOrganizerId)
    .map((eo) => eo.user.id);
}

export function isChiefTeamMemberOnEvent(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
  organizerId: string,
) {
  if (organizerId === chiefOrganizerId) return true;

  return event.eventXorganizers.some(
    (eo) =>
      eo.user.id === organizerId &&
      eo.user.chiefOrganizerId === chiefOrganizerId,
  );
}

export function filterOrganizersForChief(
  organizers: OrganizerSchema[],
  event: EventWithOrganizers,
  chiefOrganizerId: string,
) {
  return organizers.filter((o) =>
    isChiefTeamMemberOnEvent(event, chiefOrganizerId, o.id),
  );
}

export function mapEventOrganizersForChief(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
) {
  const teamRelations = event.eventXorganizers.filter(
    (eo) =>
      eo.user.id === chiefOrganizerId ||
      eo.user.chiefOrganizerId === chiefOrganizerId,
  );

  return mapEventOrganizersToSchema(
    teamRelations,
    event.inviteCondition as InviteCondition,
  );
}

export function mergeOrganizersForCapacity(
  allEventOrganizers: OrganizerSchema[],
  currentOrganizers: OrganizerSchema[],
) {
  const byId = new Map(allEventOrganizers.map((o) => [o.id, o]));
  for (const organizer of currentOrganizers) {
    byId.set(organizer.id, organizer);
  }
  return [...byId.values()];
}

export function getEventTicketTypeRefs(
  event: EventWithOrganizers,
): OrganizerTicketTypeRef[] {
  return event.ticketTypes.map((t) => ({
    name: t.name,
    maxAvailable: t.maxAvailable,
  }));
}

/**
 * Total que el jefe puede repartir entre su equipo:
 * sus tickets + los de cada organizador suyo en el evento.
 */
export function getChiefDistributableTicketPool(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
) {
  return sumInvitationTicketAmounts(
    mapEventOrganizersForChief(event, chiefOrganizerId),
  );
}

export function sumInvitationTicketAmounts(organizers: OrganizerSchema[]) {
  return organizers.reduce((sum, org) => {
    if ('ticketAmount' in org && org.ticketAmount !== null) {
      return sum + org.ticketAmount;
    }
    return sum;
  }, 0);
}

/**
 * Para límites del jefe: combina el equipo en el evento (p. ej. asignado por admin)
 * con los cambios locales del diálogo.
 */
export function getChiefCapacityOrganizers(
  event: EventWithOrganizers,
  chiefOrganizerId: string,
  currentOrganizers: OrganizerSchema[],
) {
  const teamOnEvent = mapEventOrganizersForChief(event, chiefOrganizerId);
  return mergeOrganizersForCapacity(teamOnEvent, currentOrganizers);
}

type ChiefTeamTicketSnapshot = {
  organizerId: string;
  ticketAmount: number | null;
};

type ChiefTicketInput = {
  id: string;
  ticketAmount: number | null;
};

/** Tickets liberados al quitar cupo a subordinados o eliminarlos del equipo. */
export function computeInvitationTicketsFreedForChief(
  chiefOrganizerId: string,
  organizersInput: ChiefTicketInput[],
  teamOnEvent: ChiefTeamTicketSnapshot[],
  deletedOrganizersIds: string[],
) {
  let freed = 0;

  for (const organizerId of deletedOrganizersIds) {
    const onEvent = teamOnEvent.find((o) => o.organizerId === organizerId);
    freed += onEvent?.ticketAmount ?? 0;
  }

  for (const organizer of organizersInput) {
    if (organizer.id === chiefOrganizerId) continue;

    const onEvent = teamOnEvent.find((o) => o.organizerId === organizer.id);
    const previous = onEvent?.ticketAmount ?? 0;
    const next = organizer.ticketAmount ?? 0;
    if (next < previous) {
      freed += previous - next;
    }
  }

  return freed;
}

/** Máximo que el jefe puede tener sin auto-asignarse del pool (solo base + liberados). */
export function getChiefMaxAssignableTickets(
  chiefOrganizerId: string,
  organizersInput: ChiefTicketInput[],
  teamOnEvent: ChiefTeamTicketSnapshot[],
  deletedOrganizersIds: string[],
) {
  const chiefOnEvent = teamOnEvent.find(
    (o) => o.organizerId === chiefOrganizerId,
  );
  const chiefBase = chiefOnEvent?.ticketAmount ?? 0;
  const freed = computeInvitationTicketsFreedForChief(
    chiefOrganizerId,
    organizersInput,
    teamOnEvent,
    deletedOrganizersIds,
  );

  return chiefBase + freed;
}
