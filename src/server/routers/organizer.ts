import {
  and,
  between,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  not,
} from 'drizzle-orm';
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
import { endOfDayUTC } from '@/server/utils/utils';

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
      // Get the user to check if they are a CHIEF_ORGANIZER
      const targetUser = await ctx.db.query.user.findFirst({
        where: eq(user.id, organizerId),
        columns: {
          id: true,
          role: true,
        },
      });

      if (!targetUser) {
        throw new Error('User not found');
      }

      // Get all organizer IDs to include in events (chief + their organizers if chief)
      let organizerIds = [organizerId];
      if (targetUser.role === 'CHIEF_ORGANIZER') {
        const relatedOrganizers = await ctx.db.query.user.findMany({
          where: eq(user.chiefOrganizerId, organizerId),
          columns: {
            id: true,
          },
        });
        organizerIds = [organizerId, ...relatedOrganizers.map((o) => o.id)];
      }

      // Get last 20 organizer groups (we'll later filter to those with scanned tickets)
      const recentEvents = await ctx.db.query.ticketGroup.findMany({
        where: and(
          eq(ticketGroup.isOrganizerGroup, true),
          not(eq(ticketGroup.status, 'BOOKED')),
          inArray(ticketGroup.invitedById, organizerIds),
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
          fullName: true,
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
          fullName: organizer.fullName,
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

      const targetUser = await ctx.db.query.user.findFirst({
        where: eq(user.id, organizerId),
        columns: {
          id: true,
          role: true,
        },
      });

      if (!targetUser) {
        throw new Error('User not found');
      }

      // IF its a CHIEF_ORGANIZER: Get all organizer IDs to include in stats (chief + their organizers if chief)
      let organizerIds = [organizerId];
      if (targetUser.role === 'CHIEF_ORGANIZER') {
        const relatedOrganizers = await ctx.db.query.user.findMany({
          where: eq(user.chiefOrganizerId, organizerId),
          columns: {
            id: true,
          },
        });
        organizerIds = [organizerId, ...relatedOrganizers.map((o) => o.id)];
      }

      // INVITATION: Get tickets sold (ticketXorganizer with non-null ticketId) within time period
      const ticketsSoldInvitation =
        await ctx.db.query.ticketXorganizer.findMany({
          where: and(
            inArray(ticketXorganizer.organizerId, organizerIds),
            isNotNull(ticketXorganizer.ticketId),
            between(
              ticketXorganizer.createdAt,
              from.toISOString(),
              endOfDayUTC(to).toISOString(),
            ),
          ),
          with: {
            emittedTicket: true,
          },
        });

      const attendanceCountInvitation = ticketsSoldInvitation.reduce(
        (acc, ticket) => {
          if (ticket.emittedTicket?.scanned) {
            acc++;
          }
          return acc;
        },
        0,
      );

      // TRADITIONAL: Get ticket groups with these organizers as invitedById within time period
      const ticketGroups = await ctx.db.query.ticketGroup.findMany({
        where: and(
          inArray(ticketGroup.invitedById, organizerIds),
          not(eq(ticketGroup.status, 'BOOKED')),
          between(
            ticketGroup.createdAt,
            from.toISOString(),
            endOfDayUTC(to).toISOString(),
          ),
        ),
        with: {
          emittedTickets: true,
        },
      });

      // Calculate total money generated + tickets sold count
      let ticketsSoldTraditional = 0;
      let moneyGenerated = 0;
      let attendanceCountTraditional = 0;
      for (const tg of ticketGroups) {
        const totalPrice = await calculateTotalPrice({
          ticketGroupId: tg.id,
          discountPercentage: null,
        });
        moneyGenerated += totalPrice;
        ticketsSoldTraditional += tg.amountTickets;
        attendanceCountTraditional += tg.emittedTickets.filter(
          (et) => et.scanned,
        ).length;
      }

      const ticketsSold = ticketsSoldTraditional + ticketsSoldInvitation.length;

      const attendancePercentage =
        ticketsSold > 0
          ? ((attendanceCountInvitation + attendanceCountTraditional) /
              ticketsSold) *
            100
          : 0;

      return {
        statistics: {
          ticketsSold,
          attendancePercentage,
          moneyGenerated: Math.round(moneyGenerated * 100) / 100,
        },
      };
    }),
});
