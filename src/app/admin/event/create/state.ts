import { type CreateEventSchema } from '@/server/schemas/event';
import { type CreateTicketTypeSchema } from '@/server/schemas/ticket-type';
import { createStore } from 'zustand/vanilla';

type EventState = {
  event: CreateEventSchema;
  ticketTypes: (CreateTicketTypeSchema & { id: string })[];
};
type EventActions = {
  addTicketType: (ticketType: CreateTicketTypeSchema) => void;
  updateTicketType: (id: string, ticketType: CreateTicketTypeSchema) => void;
  deleteTicketType: (id: string) => void;
  setEvent: (event: Partial<CreateEventSchema>) => void;
};

export type CreateEventStore = EventState & EventActions;

const initialState: EventState = {
  event: {
    name: '',
    description: '',
    coverImageUrl: 'https://media.tenor.com/BPSfyjEKq-0AAAAM/momo-bailando.gif',
    startingDate: new Date(),
    endingDate: new Date(),
    categoryId: '',
    isActive: false,
    locationId: '',
    minAge: null,
  },
  ticketTypes: [],
};

export const createEventStore = (initState: EventState = initialState) => {
  return createStore<CreateEventStore>((set) => ({
    ...initState,
    setEvent: (event) => {
      set((state) => ({ event: { ...state.event, ...event } }));
    },
    addTicketType: (ticketType) => {
      set((state) => ({
        ticketTypes: [
          ...state.ticketTypes,
          { ...ticketType, id: crypto.randomUUID() },
        ],
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
