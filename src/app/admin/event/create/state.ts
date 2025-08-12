import { type CreateEventSchema } from '@/server/schemas/event';
import { type TicketType } from '@/server/types';
import { createStore } from 'zustand/vanilla';

type EventState = {
  event: CreateEventSchema;
};
type EventActions = {
  addTicketType: (ticketType: TicketType) => void;
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
    ticketTypes: [],
  },
};

export const createEventStore = (initState: EventState = initialState) => {
  return createStore<CreateEventStore>((set) => ({
    ...initState,
    setEvent: (event) => {
      console.log(event);
      set((state) => ({ event: { ...state.event, ...event } }));
    },
    addTicketType: (ticketType) =>
      set((state) => ({
        event: {
          ...state.event,
          ticketTypes: [
            ...state.event.ticketTypes,
            {
              ...ticketType,
              maxSellDate:
                ticketType.maxSellDate && ticketType.maxSellDate.length > 0
                  ? new Date(ticketType.maxSellDate)
                  : null,
              scanLimit:
                ticketType.scanLimit && ticketType.scanLimit.length > 0
                  ? new Date(ticketType.scanLimit)
                  : null,
            },
          ],
        },
      })),
  }));
};
// https://zustand.docs.pmnd.rs/guides/nextjs
