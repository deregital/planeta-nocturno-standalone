import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';

import { emittedTicketsRouter } from '@/server/routers/emitted-tickets';
import { eventCategoriesRouter } from '@/server/routers/event-categories';
import { eventFolderRouter } from '@/server/routers/event-folder';
import { eventsRouter } from '@/server/routers/events';
import { featureRouter } from '@/server/routers/feature';
import { locationRouter } from '@/server/routers/location';
import { mailRouter } from '@/server/routers/mail';
import { mercadoPagoRouter } from '@/server/routers/mercado-pago';
import { organizerRouter } from '@/server/routers/organizer';
import { statisticsRouter } from '@/server/routers/statistics';
import { tagRouter } from '@/server/routers/tag';
import { ticketGroupRouter } from '@/server/routers/ticket-group';
import { userRouter } from '@/server/routers/user';
import { router } from '@/server/trpc';

export const appRouter = router({
  events: eventsRouter,
  ticketGroup: ticketGroupRouter,
  emittedTickets: emittedTicketsRouter,
  mercadoPago: mercadoPagoRouter,
  mail: mailRouter,
  location: locationRouter,
  eventCategory: eventCategoriesRouter,
  statistics: statisticsRouter,
  user: userRouter,
  feature: featureRouter,
  organizer: organizerRouter,
  eventFolder: eventFolderRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
