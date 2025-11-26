import { and, between, desc, eq, isNotNull, isNull, not } from 'drizzle-orm';
import { z } from 'zod';

import {
  emittedTicket,
  eventXorganizer,
  ticketGroup,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { eventSchema } from '@/server/schemas/event';
import { organizerBaseSchema } from '@/server/schemas/organizer';
import { calculateTotalPrice } from '@/server/services/ticketGroup';
import { adminProcedure, organizerProcedure, router } from '@/server/trpc';

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
  getAdminInfoById: adminProcedure
    .input(organizerBaseSchema.shape.id)
    .query(async ({ ctx, input: organizerId }) => {
      // Get recent events attended (ordered by endingDate descending)

      // Get last 20 organizer groups (we'll later filter to those with scanned tickets)
      const recentEvents = await ctx.db.query.ticketGroup.findMany({
        where: and(
          eq(ticketGroup.isOrganizerGroup, true),
          not(eq(ticketGroup.status, 'BOOKED')),
        ),
        with: {
          emittedTickets: {
            columns: {
              scanned: true,
            },
          },
          event: {
            columns: {
              id: true,
              name: true,
              startingDate: true,
              endingDate: true,
            },
            with: {
              location: {
                columns: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: desc(ticketGroup.createdAt),
        limit: 20,
      });

      // Keep only ticketGroups where at least one emittedTicket was scanned
      const recentEventsWithScan = recentEvents.filter((tg) =>
        tg.emittedTickets.some((et) => et.scanned),
      );

      const organizer = await ctx.db.query.user.findFirst({
        where: eq(user.id, organizerId),
        columns: {
          name: true,
          email: true,
          phoneNumber: true,
          instagram: true,
        },
      });

      if (!organizer) {
        throw new Error('Organizer not found');
      }

      return {
        recentEvents: recentEventsWithScan.map((rel) => ({
          id: rel.event.id,
          name: rel.event.name,
          startingDate: rel.event.startingDate,
          endingDate: rel.event.endingDate,
          location: rel.event.location,
        })),
        organizer: {
          id: organizerId,
          name: organizer.name,
          email: organizer.email,
          phoneNumber: organizer.phoneNumber,
          instagram: organizer.instagram,
        },
      };
    }),
  getAdminStatsById: adminProcedure
    .input(
      z.object({
        organizerId: organizerBaseSchema.shape.id,
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { organizerId, from, to } = input;

      // Get all events assigned to this organizer
      const allAssignedEvents = await ctx.db.query.eventXorganizer.findMany({
        where: eq(eventXorganizer.organizerId, organizerId),
        with: {
          event: true,
        },
      });

      // Count events attended (events that have ended)
      const now = new Date();
      const eventsAttended = allAssignedEvents.filter(
        (rel) => new Date(rel.event.endingDate) < now,
      ).length;
      const totalEventsAssigned = allAssignedEvents.length;
      const attendancePercentage =
        totalEventsAssigned > 0
          ? (eventsAttended / totalEventsAssigned) * 100
          : 0;

      // Get tickets sold (ticketXorganizer with non-null ticketId) within time period
      const ticketsSold = await ctx.db.query.ticketXorganizer.findMany({
        where: and(
          eq(ticketXorganizer.organizerId, organizerId),
          isNotNull(ticketXorganizer.ticketId),
          between(
            ticketXorganizer.createdAt,
            from.toISOString(),
            to.toISOString(),
          ),
        ),
      });

      const ticketsSoldCount = ticketsSold.length;

      // Get ticket groups with this organizer as invitedById within time period
      const ticketGroups = await ctx.db.query.ticketGroup.findMany({
        where: and(
          eq(ticketGroup.invitedById, organizerId),
          between(ticketGroup.createdAt, from.toISOString(), to.toISOString()),
          not(eq(ticketGroup.status, 'BOOKED')),
        ),
      });

      // Calculate total money generated
      let moneyGenerated = 0;
      for (const tg of ticketGroups) {
        try {
          const totalPrice = await calculateTotalPrice({
            ticketGroupId: tg.id,
            discountPercentage: null,
          });
          moneyGenerated += totalPrice;
        } catch (error) {
          // Skip if calculation fails
          console.error(
            `Error calculating price for ticketGroup ${tg.id}:`,
            error,
          );
        }
      }

      return {
        statistics: {
          ticketsSold: ticketsSoldCount,
          attendancePercentage: Math.round(attendancePercentage * 100) / 100,
          moneyGenerated: Math.round(moneyGenerated * 100) / 100,
        },
      };
    }),
});
