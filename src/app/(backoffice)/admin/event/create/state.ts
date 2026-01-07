import { createStore } from 'zustand/vanilla';

import { type CreateEventSchema } from '@/server/schemas/event';
import {
  type OrganizerBaseSchema,
  type OrganizerSchema,
} from '@/server/schemas/organizer';
import {
  type CreateTicketTypeSchema,
  type TicketTypeSchema,
} from '@/server/schemas/ticket-type';
import { type InviteCondition } from '@/server/types';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export type EventState = {
  event: CreateEventSchema;
  ticketTypes: (
    | (CreateTicketTypeSchema & { id: string | null })
    | TicketTypeSchema
  )[];
  organizers: OrganizerSchema[];
};
type EventActions = {
  addTicketType: (ticketType: CreateTicketTypeSchema) => void;
  updateTicketType: (id: string, ticketType: CreateTicketTypeSchema) => void;
  deleteTicketType: (id: string) => void;
  setTicketTypes: (ticketTypes: TicketTypeSchema[]) => void;
  setEvent: (event: Partial<CreateEventSchema>) => void;
  resetOrganizers: () => void;
  addOrganizer: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
  editOrganizer: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
  setOrganizers: (organizers: OrganizerSchema[]) => void;
  deleteOrganizer: (organizer: OrganizerBaseSchema) => void;
  updateAllOrganizerNumber: (number: number, type: InviteCondition) => void;
  updateOrganizerNumber: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
  addOrganizerTicketType: () => void;
  updateOrganizerTicketType: () => void;
};

export type CreateEventStore = EventState & EventActions;

const initialState: EventState = {
  event: {
    name: '',
    description: '',
    coverImageUrl: '',
    startingDate: new Date(),
    endingDate: new Date(),
    categoryId: '',
    isActive: false,
    locationId: '',
    minAge: null,
    authorizedUsers: [],
    inviteCondition: 'TRADITIONAL',
    extraTicketData: false,
    serviceFee: null,
    emailNotification: null,
    ticketSlugVisibleInPdf: false,
  },
  ticketTypes: [],
  organizers: [],
};

function calculateOrganizerMaxAvailable(
  organizers: OrganizerSchema[],
  inviteCondition: InviteCondition,
): number {
  if (inviteCondition === 'INVITATION') {
    return organizers.reduce((acc, organizer) => {
      if ('ticketAmount' in organizer && organizer.ticketAmount !== null) {
        return acc + organizer.ticketAmount;
      }
      return acc;
    }, 0);
  }
  return organizers.length;
}

function updateOrganizerTicketTypeMaxAvailable(
  ticketTypes: EventState['ticketTypes'],
  maxAvailable: number,
): EventState['ticketTypes'] {
  const organizerTicketType = ticketTypes.find(
    (t) => t.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim(),
  );

  if (!organizerTicketType?.id) {
    return ticketTypes;
  }

  return ticketTypes.map((t) =>
    t.id === organizerTicketType.id ? { ...t, maxAvailable } : t,
  );
}

export const createEventStore = (initState: EventState = initialState) => {
  return createStore<CreateEventStore>((set) => ({
    ...initState,
    setEvent: (event) => {
      set((state) => ({ event: { ...state.event, ...event } }));
    },
    setTicketTypes: (ticketTypes) => {
      set(() => ({
        ticketTypes,
      }));
    },
    setOrganizers: (organizers) => {
      set((state) => {
        const maxAvailable = calculateOrganizerMaxAvailable(
          organizers,
          state.event.inviteCondition,
        );

        return {
          organizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    resetOrganizers: () => {
      set((state) => ({
        organizers: [],
        ticketTypes: updateOrganizerTicketTypeMaxAvailable(
          state.ticketTypes,
          0,
        ),
      }));
    },
    addOrganizer: (organizer, number, type) => {
      set((state) => {
        const newOrganizer =
          type === 'TRADITIONAL'
            ? ({
                ...organizer,
                type: 'TRADITIONAL' as const,
                discountPercentage: number,
              } as const)
            : ({
                ...organizer,
                type: 'INVITATION' as const,
                ticketAmount: number,
              } as const);

        const newOrganizers = [...state.organizers, newOrganizer];
        const maxAvailable = calculateOrganizerMaxAvailable(
          newOrganizers,
          state.event.inviteCondition,
        );

        return {
          organizers: newOrganizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    editOrganizer: (organizer, number, type) => {
      set((state) => {
        const newOrganizers = state.organizers.map((o) =>
          o.id === organizer.id
            ? type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : { ...o, ticketAmount: number }
            : o,
        );

        const maxAvailable = calculateOrganizerMaxAvailable(
          newOrganizers,
          state.event.inviteCondition,
        );

        return {
          organizers: newOrganizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    deleteOrganizer: (organizer: OrganizerBaseSchema) => {
      set((state) => {
        const newOrganizers = state.organizers.filter(
          (o) => o.id !== organizer.id,
        );

        const maxAvailable = calculateOrganizerMaxAvailable(
          newOrganizers,
          state.event.inviteCondition,
        );

        return {
          organizers: newOrganizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    updateAllOrganizerNumber: (number: number, type: InviteCondition) => {
      set((state) => {
        const newOrganizers = state.organizers.map((o) =>
          type === 'TRADITIONAL'
            ? { ...o, discountPercentage: number }
            : { ...o, ticketAmount: number },
        );

        const maxAvailable = calculateOrganizerMaxAvailable(
          newOrganizers,
          state.event.inviteCondition,
        );

        return {
          organizers: newOrganizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    updateOrganizerNumber: (organizer, number, type) => {
      set((state) => {
        const newOrganizers = state.organizers.map((o) =>
          o.id === organizer.id
            ? type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : { ...o, ticketAmount: number }
            : o,
        );

        const maxAvailable = calculateOrganizerMaxAvailable(
          newOrganizers,
          state.event.inviteCondition,
        );

        return {
          organizers: newOrganizers,
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
    addTicketType: (ticketType) => {
      const newID = crypto.randomUUID();
      set((state) => ({
        ticketTypes: [...state.ticketTypes, { ...ticketType, id: newID }],
      }));
    },
    updateTicketType: (
      id: string,
      updatedTicketType: CreateTicketTypeSchema,
    ) => {
      set((state) => ({
        ticketTypes: state.ticketTypes.map((t) =>
          t.id === id ? { ...t, ...updatedTicketType } : t,
        ),
      }));
    },
    deleteTicketType: (id: string) => {
      set((state) => ({
        ticketTypes: state.ticketTypes.filter((t) => t.id !== id),
      }));
    },
    addOrganizerTicketType: () => {
      set((state) => {
        const maxAvailable = calculateOrganizerMaxAvailable(
          state.organizers,
          state.event.inviteCondition,
        );

        return {
          ticketTypes: [
            ...state.ticketTypes,
            {
              id: crypto.randomUUID(),
              name: ORGANIZER_TICKET_TYPE_NAME,
              description: 'Tickets para los organizadores',
              price: 0,
              maxAvailable,
              maxPerPurchase: 1,
              category: 'FREE',
              lowStockThreshold: null,
              maxSellDate: null,
              scanLimit: null,
              visibleInWeb: false,
            },
          ],
        };
      });
    },
    updateOrganizerTicketType: () => {
      set((state) => {
        const maxAvailable = calculateOrganizerMaxAvailable(
          state.organizers,
          state.event.inviteCondition,
        );

        return {
          ticketTypes: updateOrganizerTicketTypeMaxAvailable(
            state.ticketTypes,
            maxAvailable,
          ),
        };
      });
    },
  }));
};
// https://zustand.docs.pmnd.rs/guides/nextjs
