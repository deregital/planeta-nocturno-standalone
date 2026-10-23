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

export type InvitationTicketHolder = {
  id: string;
  tickets: number;
  /** No se pueden quitar: ya entregados, o 1 si sigue en el evento. */
  locked: number;
};

export type InvitationTicketEditLimits = {
  lockedByOrganizerId: Record<string, number>;
  maxCapacity: number;
  usesTicketPool: boolean;
  /** Tickets ya entregados del jefe: no entran en el reparto. */
  reservedTickets?: number;
  /** El jefe no se edita en la tabla; su cupo es lo que sobra del pool. */
  balanceHolderId?: string;
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
    ticketLimits?: InvitationTicketEditLimits,
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
  const remaining = getInvitationUnassignedTickets({
    maxCapacity,
    usesTicketPool,
    organizerCount: organizers.length,
    assignedTickets: assigned,
  });

  return Math.max(0, remaining);
}

/**
 * Tickets que todavía no están asignados a ningún organizador.
 * Negativo si la asignación actual se pasa de la capacidad.
 */
function getInvitationUnassignedTickets({
  maxCapacity,
  usesTicketPool,
  organizerCount,
  assignedTickets,
}: InvitationOrganizerCapacityOptions & {
  organizerCount: number;
  assignedTickets: number;
}): number {
  return usesTicketPool
    ? maxCapacity - assignedTickets
    : maxCapacity - organizerCount - assignedTickets;
}

/**
 * Máximo al crear o editar sin mover tickets ajenos:
 * lo que esta persona ya tiene más los que siguen sin asignar.
 */
export function getInvitationMaxTicketsForOrganizer({
  maxCapacity,
  usesTicketPool,
  organizerCount,
  assignedTickets,
  thisOrganizerTickets,
}: InvitationOrganizerCapacityOptions & {
  organizerCount: number;
  assignedTickets: number;
  thisOrganizerTickets: number;
}): number {
  const unassigned = getInvitationUnassignedTickets({
    maxCapacity,
    usesTicketPool,
    organizerCount,
    assignedTickets,
  });

  return Math.max(0, thisOrganizerTickets + unassigned);
}

/**
 * Máximo al redistribuir: todos los tickets que no están clavados
 * en otra persona (ya entregados, o el mínimo de 1).
 */
export function getInvitationHolderMax({
  holders,
  holderId,
  maxCapacity,
  seatCount = 0,
  reservedTickets = 0,
}: {
  holders: InvitationTicketHolder[];
  holderId: string;
  maxCapacity: number;
  seatCount?: number;
  reservedTickets?: number;
}): number {
  const othersLocked = holders.reduce(
    (sum, holder) => (holder.id === holderId ? sum : sum + holder.locked),
    0,
  );

  return Math.max(0, maxCapacity - seatCount - reservedTickets - othersLocked);
}

export function applyInvitationTicketEdit({
  holders,
  holderId,
  nextTickets,
  maxCapacity,
  seatCount = 0,
  reservedTickets = 0,
}: {
  holders: InvitationTicketHolder[];
  holderId: string;
  nextTickets: number;
  maxCapacity: number;
  seatCount?: number;
  reservedTickets?: number;
}): InvitationTicketHolder[] {
  const nextHolders = holders.map((holder) => ({ ...holder }));
  const target = nextHolders.find((holder) => holder.id === holderId);
  if (!target) return nextHolders;

  const maxTickets = getInvitationHolderMax({
    holders: nextHolders,
    holderId,
    maxCapacity,
    seatCount,
    reservedTickets,
  });
  const upperBound = Math.max(maxTickets, target.locked);
  target.tickets = Math.min(Math.max(nextTickets, target.locked), upperBound);

  let excess =
    nextHolders.reduce((sum, holder) => sum + holder.tickets, 0) +
    seatCount +
    reservedTickets -
    maxCapacity;

  if (excess <= 0) return nextHolders;

  const donors = nextHolders
    .filter((holder) => holder.id !== holderId)
    .sort((a, b) => b.tickets - b.locked - (a.tickets - a.locked));

  for (const donor of donors) {
    if (excess <= 0) break;
    const spare = Math.max(0, donor.tickets - donor.locked);
    const taken = Math.min(spare, excess);
    donor.tickets -= taken;
    excess -= taken;
  }

  if (excess > 0) {
    const spare = Math.max(0, target.tickets - target.locked);
    target.tickets -= Math.min(spare, excess);
  }

  return nextHolders;
}

export function buildInvitationTicketEditLimits({
  holderIds,
  deliveredByOrganizerId,
  maxCapacity,
  usesTicketPool,
  balanceHolderId,
}: {
  holderIds: string[];
  deliveredByOrganizerId: Record<string, number>;
  maxCapacity: number;
  usesTicketPool: boolean;
  balanceHolderId?: string;
}): InvitationTicketEditLimits {
  const lockedByOrganizerId: Record<string, number> = {};

  for (const holderId of holderIds) {
    if (holderId === balanceHolderId) continue;
    lockedByOrganizerId[holderId] = Math.max(
      INVITATION_MIN_TICKETS,
      deliveredByOrganizerId[holderId] ?? 0,
    );
  }

  return {
    lockedByOrganizerId,
    maxCapacity,
    usesTicketPool,
    reservedTickets: balanceHolderId
      ? (deliveredByOrganizerId[balanceHolderId] ?? 0)
      : 0,
    balanceHolderId,
  };
}

export function applyInvitationOrganizerTicketEdit(
  organizers: OrganizerSchema[],
  organizerId: string,
  nextTickets: number,
  limits: InvitationTicketEditLimits,
): OrganizerSchema[] {
  const editable = organizers.filter(
    (organizer) =>
      organizer.type === 'INVITATION' &&
      organizer.id !== limits.balanceHolderId,
  );
  const holders: InvitationTicketHolder[] = editable.map((organizer) => ({
    id: organizer.id,
    tickets: getInvitationTicketAmount(organizer),
    locked: limits.lockedByOrganizerId[organizer.id] ?? INVITATION_MIN_TICKETS,
  }));
  const updated = applyInvitationTicketEdit({
    holders,
    holderId: organizerId,
    nextTickets,
    maxCapacity: limits.maxCapacity,
    seatCount: limits.usesTicketPool ? 0 : editable.length,
    reservedTickets: limits.reservedTickets ?? 0,
  });
  const amounts = new Map(updated.map((holder) => [holder.id, holder.tickets]));

  return organizers.map((organizer) =>
    amounts.has(organizer.id) && organizer.type === 'INVITATION'
      ? { ...organizer, ticketAmount: amounts.get(organizer.id)! }
      : organizer,
  );
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
