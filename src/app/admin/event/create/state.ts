import { createStore } from 'zustand/vanilla';

import { type CreateEventSchema } from '@/server/schemas/event';
import {
  type CreateTicketTypeSchema,
  type TicketTypeSchema,
} from '@/server/schemas/ticket-type';
import {
  type OrganizerBaseSchema,
  type OrganizerSchema,
} from '@/server/schemas/organizer';
import { type InviteCondition } from '@/server/types';

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
  deleteOrganizer: (organizer: OrganizerBaseSchema) => void;
  updateAllOrganizerNumber: (number: number, type: InviteCondition) => void;
  updateOrganizerNumber: (
    organizer: OrganizerBaseSchema,
    number: number,
    type: InviteCondition,
  ) => void;
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
  },
  ticketTypes: [],
  organizers: [],
};

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
    resetOrganizers: () => {
      set(() => ({
        organizers: [],
      }));
    },
    addOrganizer: (organizer, number, type) => {
      set((state) => ({
        organizers: [
          ...state.organizers,
          type === 'TRADITIONAL'
            ? { ...organizer, discountPercentage: number }
            : { ...organizer, ticketAmount: number },
        ],
      }));
    },
    editOrganizer: (organizer, number, type) => {
      set((state) => ({
        organizers: state.organizers.map((o) =>
          o.id === organizer.id
            ? type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : { ...o, ticketAmount: number }
            : o,
        ),
      }));
    },
    deleteOrganizer: (organizer: OrganizerBaseSchema) => {
      set((state) => ({
        organizers: state.organizers.filter((o) => o.id !== organizer.id),
      }));
    },
    updateAllOrganizerNumber: (number: number, type: InviteCondition) => {
      set((state) => ({
        organizers: state.organizers.map((o) =>
          type === 'TRADITIONAL'
            ? { ...o, discountPercentage: number }
            : { ...o, ticketAmount: number },
        ),
      }));
    },
    updateOrganizerNumber: (organizer, number, type) => {
      set((state) => ({
        organizers: state.organizers.map((o) =>
          o.id === organizer.id
            ? type === 'TRADITIONAL'
              ? { ...o, discountPercentage: number }
              : { ...o, ticketAmount: number }
            : o,
        ),
      }));
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
  }));
};
// https://zustand.docs.pmnd.rs/guides/nextjs
