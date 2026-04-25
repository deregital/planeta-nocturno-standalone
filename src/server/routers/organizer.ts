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
  event,
  eventXorganizer,
  ticketGroup,
  ticketXorganizer,
  user,
} from '@/drizzle/schema';
import { eventSchema } from '@/server/schemas/event';
import { organizerBaseSchema } from '@/server/schemas/organizer';
import {
  chiefOrganizerProcedure,
  organizerProcedure,
  router,
} from '@/server/trpc';
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
    return myEventsRelation.filter(
      (relation) => relation.event && !relation.event.isDeleted,
    );
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
  getInfoById: chiefOrganizerProcedure
    .input(organizerBaseSchema.shape.id)
    .query(async ({ ctx, input: organizerId }) => {
      // Check if user exists
      const organizer = await ctx.db.query.user.findFirst({
        where: eq(user.id, organizerId),
        columns: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          instagram: true,
          role: true,
          mercadopago: true,
          googleDriveUrl: true,
        },
      });

      if (!organizer) {
        throw new Error('Organizer not found');
      }

      // Get last 20 events
      const events = await ctx.db.query.event.findMany({
        where: and(eq(event.isDeleted, false), eq(event.isActive, true)),
        with: {
          ticketGroups: {
            columns: {
              isOrganizerGroup: true,
            },
            with: {
              emittedTickets: true,
            },
          },
          location: {
            columns: {
              name: true,
            },
          },
        },
        orderBy: desc(event.endingDate),
        limit: 20,
      });

      const assistedEvents = events.filter((e) =>
        e.ticketGroups.some((tg) =>
          tg.emittedTickets.some(
            (et) => et.scanned && et.mail === organizer.email,
          ),
        ),
      );

      return {
        recentEvents: assistedEvents.map((e) => ({
          id: e.id,
          name: e.name,
          startingDate: e.startingDate,
          endingDate: e.endingDate,
          location: e.location,
        })),
        organizer,
      };
    }),
  getStatsById: chiefOrganizerProcedure
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
            emittedTicket: {
              columns: {
                scanned: true,
              },
            },
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
          emittedTickets: {
            columns: {
              scanned: true,
            },
          },
          event: {
            with: {
              eventXorganizers: {
                where: inArray(eventXorganizer.organizerId, organizerIds),
              },
            },
          },
        },
      });

      // Calculate traditional stats
      let ticketsSoldTraditional = 0;
      let totalGenerated = 0;
      let attendanceCountTraditional = 0;
      for (const tg of ticketGroups) {
        totalGenerated += Number(tg.totalAmount);
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
          totalGenerated: Math.round(totalGenerated * 100) / 100,
        },
      };
    }),
});
