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
