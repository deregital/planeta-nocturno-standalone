import { and, desc, eq, isNull, not } from 'drizzle-orm';

import {
  emittedTicket,
  eventXorganizer,
  ticketGroup,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
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
  getMyCodesNotUsed: organizerProcedure
    .input(eventSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const codes = await ctx.db.query.ticketXorganizer.findMany({
        where: and(
          eq(ticketXorganizer.organizerId, ctx.session.user.id),
          isNull(ticketXorganizer.ticketId),
          eq(ticketXorganizer.eventId, input),
        ),
        orderBy: desc(ticketXorganizer.code),
      });
      return codes.map((code) => ({
        id: code.code,
        code: code.code,
        createdAt: code.createdAt,
      }));
    }),
  getMyCode: organizerProcedure.query(async ({ ctx }) => {
    const code = await ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.session.user.id),
      columns: {
        code: true,
      },
    });
    return code?.code;
  }),
});
