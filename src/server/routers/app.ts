import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';

import { eventsRouter } from '@/server/routers/events';
import { router } from '@/server/trpc';
import { ticketGroupRouter } from '@/server/routers/ticket-group';
import { emittedTicketsRouter } from '@/server/routers/emitted-tickets';
import { mercadoPagoRouter } from '@/server/routers/mercado-pago';
import { mailRouter } from '@/server/routers/mail';
import { eventCategoriesRouter } from '@/server/routers/event-categories';
import { locationRouter } from '@/server/routers/location';
import { statisticsRouter } from '@/server/routers/statistics';

export const appRouter = router({
  events: eventsRouter,
  ticketGroup: ticketGroupRouter,
  emittedTickets: emittedTicketsRouter,
  mercadoPago: mercadoPagoRouter,
  mail: mailRouter,
  location: locationRouter,
  eventCategory: eventCategoriesRouter,
  statistics: statisticsRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
