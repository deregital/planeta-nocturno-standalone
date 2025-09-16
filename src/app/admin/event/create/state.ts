import { createStore } from 'zustand/vanilla';

import { type CreateEventSchema } from '@/server/schemas/event';
import {
  type CreateTicketTypeSchema,
  type TicketTypeSchema,
} from '@/server/schemas/ticket-type';

export type EventState = {
  event: CreateEventSchema;
  ticketTypes: (
    | (CreateTicketTypeSchema & { id: string | null })
    | TicketTypeSchema
  )[];
};
type EventActions = {
  addTicketType: (ticketType: CreateTicketTypeSchema) => void;
  updateTicketType: (id: string, ticketType: CreateTicketTypeSchema) => void;
  deleteTicketType: (id: string) => void;
  setTicketTypes: (ticketTypes: TicketTypeSchema[]) => void;
  setEvent: (event: Partial<CreateEventSchema>) => void;
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
    authorizedUsersId: [],
  },
  ticketTypes: [],
};

export const createEventStore = (initState: EventState = initialState) => {
  return createStore<CreateEventStore>((set) => ({
    ...initState,
    setEvent: (event) => {
      set((state) => ({ event: { ...state.event, ...event } }));
    },
    setTicketTypes: (ticketTypes) => {
      set((state) => ({
        ticketTypes,
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
