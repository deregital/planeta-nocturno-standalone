import { and, desc, eq, not } from 'drizzle-orm';

import { emittedTicket, eventXorganizer, ticketGroup } from '@/drizzle/schema';
import { organizerProcedure, router } from '@/server/trpc';
import { eventSchema } from '@/server/schemas/event';

export const organizerRouter = router({
  getMyEvents: organizerProcedure.query(async ({ ctx }) => {
    const myEventsRelation = await ctx.db.query.eventXorganizer.findMany({
      where: eq(eventXorganizer.organizerId, ctx.session.user.id),
      with: {
        event: {
          with: {
            ticketTypes: true,
            location: true,
          },
        },
      },
    });
    return myEventsRelation;
  }),
  getMyTicketsSold: organizerProcedure
    .input(eventSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const tickets = await ctx.db
        .select()
        .from(emittedTicket)
        .innerJoin(
          ticketGroup,
          and(
            not(eq(ticketGroup.status, 'BOOKED')),
            eq(ticketGroup.invitedById, ctx.session.user.id),
            eq(emittedTicket.ticketGroupId, ticketGroup.id),
          ),
        )
        .where(eq(ticketGroup.eventId, input))
        .orderBy(desc(emittedTicket.createdAt));
      return tickets.map((ticket) => ticket.emittedTicket);
    }),
});
