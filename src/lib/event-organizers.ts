import {
  type OrganizerBaseSchema,
  type OrganizerSchema,
} from '@/server/schemas/organizer';
import { type InviteCondition } from '@/server/types';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export type OrganizerTicketTypeRef = {
  name: string;
  maxAvailable: number;
};

export type EventOrganizersState = {
  organizers: OrganizerSchema[];
  addOrganizer: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
  /** INVITATION: asigna desde tickets restantes o quita 1 al que más tiene. */
  addInvitationOrganizersStealingTickets: (
    organizers: OrganizerBaseSchema[],
    capacity: InvitationOrganizerCapacityOptions,
  ) => boolean;
  deleteOrganizer: (organizer: OrganizerBaseSchema) => void;
  updateOrganizerNumber: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
  updateAllOrganizerNumber: (number: number, type: InviteCondition) => void;
  sendOrganizerTicketEmail: boolean;
  setSendOrganizerTicketEmail: (value: boolean) => void;
  locationId: string | null | undefined;
  ticketTypes: OrganizerTicketTypeRef[];
  eventId?: string;
};

type EventOrganizerRelation = {
  discountPercentage: number | null;
  ticketAmount: number | null;
  user: {
    dni: string;
    id: string;
    fullName: string;
    phoneNumber: string;
    role: OrganizerBaseSchema['role'];
  };
};

export function mapEventOrganizersToSchema(
  eventXorganizers: EventOrganizerRelation[],
  inviteCondition: InviteCondition,
): OrganizerSchema[] {
  return eventXorganizers.map((e) => {
    const base = {
      dni: e.user.dni,
      id: e.user.id,
      fullName: e.user.fullName,
      phoneNumber: e.user.phoneNumber,
      role: e.user.role,
    };

    return inviteCondition === 'TRADITIONAL'
      ? {
          ...base,
          type: 'TRADITIONAL' as const,
          discountPercentage: e.discountPercentage,
        }
      : {
          ...base,
          type: 'INVITATION' as const,
          ticketAmount: e.ticketAmount,
        };
  });
}

export function getTotalTicketsWithoutOrganizer(
  ticketTypes: OrganizerTicketTypeRef[],
) {
  return ticketTypes
    .filter((t) => t.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim())
    .reduce((acc, t) => acc + t.maxAvailable, 0);
}

const INVITATION_MIN_TICKETS = 1;

export function getInvitationTicketAmount(organizer: OrganizerSchema): number {
  if (organizer.type !== 'INVITATION' || organizer.ticketAmount === null) {
    return 0;
  }
  return organizer.ticketAmount;
}

export type InvitationOrganizerCapacityOptions = {
  maxCapacity: number;
  usesTicketPool: boolean;
};

export function getInvitationAssignedTickets(
  organizers: OrganizerSchema[],
): number {
  return organizers.reduce(
    (sum, org) => sum + getInvitationTicketAmount(org),
    0,
  );
}

/** Misma fórmula que el resumen "Tickets restantes" en EventOrganizers. */
export function getInvitationRemainingTickets(
  organizers: OrganizerSchema[],
  { maxCapacity, usesTicketPool }: InvitationOrganizerCapacityOptions,
): number {
  const assigned = getInvitationAssignedTickets(organizers);
  const remaining = usesTicketPool
    ? maxCapacity - assigned
    : maxCapacity - organizers.length - assigned;

  return Math.max(0, remaining);
}

/** Cuánto consume del pool agregar 1 organizador con 1 ticket de invitación. */
export function getInvitationAddCost(usesTicketPool: boolean): number {
  return usesTicketPool ? INVITATION_MIN_TICKETS : INVITATION_MIN_TICKETS + 1;
}

export function countStealableInvitationTickets(
  organizers: OrganizerSchema[],
): number {
  return organizers.reduce(
    (sum, org) =>
      sum +
      Math.max(0, getInvitationTicketAmount(org) - INVITATION_MIN_TICKETS),
    0,
  );
}

function findInvitationOrganizerWithMostTickets(
  organizers: OrganizerSchema[],
): OrganizerSchema | null {
  let best: OrganizerSchema | null = null;
  let bestAmount = INVITATION_MIN_TICKETS;

  for (const org of organizers) {
    const amount = getInvitationTicketAmount(org);
    if (amount > bestAmount) {
      bestAmount = amount;
      best = org;
    }
  }

  return best;
}

export function applyAddInvitationOrganizersStealingTickets(
  current: OrganizerSchema[],
  toAdd: OrganizerBaseSchema[],
  capacity: InvitationOrganizerCapacityOptions,
): { organizers: OrganizerSchema[] } | { error: string } {
  const pending = toAdd.filter(
    (org) => !current.some((existing) => existing.id === org.id),
  );

  if (pending.length === 0) {
    return { organizers: current };
  }

  const result = [...current];
  const addCost = getInvitationAddCost(capacity.usesTicketPool);

  for (const base of pending) {
    const remaining = getInvitationRemainingTickets(result, capacity);

    if (remaining >= addCost) {
      result.push({
        ...base,
        type: 'INVITATION',
        ticketAmount: INVITATION_MIN_TICKETS,
      });
      continue;
    }

    const donor = findInvitationOrganizerWithMostTickets(result);
    if (!donor || donor.type !== 'INVITATION') {
      return {
        error:
          'No hay tickets restantes ni tickets que se puedan reasignar (algún organizador debe tener más de 1).',
      };
    }

    const donorAmount = getInvitationTicketAmount(donor);
    const donorIndex = result.findIndex((o) => o.id === donor.id);
    result[donorIndex] = {
      ...donor,
      ticketAmount: donorAmount - 1,
    };

    result.push({
      ...base,
      type: 'INVITATION',
      ticketAmount: INVITATION_MIN_TICKETS,
    });
  }

  return { organizers: result };
}
