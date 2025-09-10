import { format, getHours, isSameDay, parseISO } from 'date-fns';
import { and, between, eq, ne } from 'drizzle-orm';
import z from 'zod';

import { emittedTicket, event, ticketGroup } from '@/drizzle/schema';
import { adminProcedure, router } from '@/server/trpc';

export const statisticsRouter = router({
  getStatistics: adminProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const data = await ctx.db.query.ticketGroup.findMany({
        where: and(
          between(
            ticketGroup.createdAt,
            input.from.toISOString(),
            input.to.toISOString(),
          ),
          ne(ticketGroup.status, 'BOOKED'),
        ),
        with: {
          ticketTypePerGroups: {
            columns: {
              amount: true,
            },
            with: {
              ticketType: {
                columns: {
                  price: true,
                },
              },
            },
          },
          emittedTickets: {
            columns: {
              scanned: true,
              gender: true,
              scannedAt: true,
            },
          },
        },
      });

      // Total raised & sold per ticketType per ticketGroup (ttpg: ticketTypePerGroups)
      const { totalRaised, totalSold } = data
        .flatMap((ticketGroup) => ticketGroup.ticketTypePerGroups)
        .reduce(
          (acc, ttpg) => {
            const price = ttpg.ticketType?.price ?? 0;
            const amount = ttpg.amount ?? 0;

            acc.totalRaised += amount * price;
            acc.totalSold += amount;

            return acc;
          },
          { totalRaised: 0, totalSold: 0 },
        );

      // Asistencia
      const allTickets = data.flatMap((tg) => tg.emittedTickets);
      const { totalTickets, totalScanned } = allTickets.reduce(
        (acc, ticket) => {
          acc.totalTickets++;
          if (ticket.scanned) {
            acc.totalScanned++;
          }

          return acc;
        },
        { totalTickets: 0, totalScanned: 0 },
      );
      const scannedPercentage =
        totalTickets > 0 ? (totalScanned / totalTickets) * 100 : 0;

      // Asistencia por genero y por hora
      const genderCounts: Record<string, number> = {};

      for (const ticket of allTickets) {
        if (!ticket.scanned) continue;
        const gender = ticket.gender;
        if (!genderCounts[gender]) {
          genderCounts[gender] = 0;
        }
        genderCounts[gender]++;
      }

      return {
        totalRaised,
        totalSold,
        totalTickets,
        totalScanned,
        scannedPercentage,
        genderCounts,
      };
    }),
  getEventsStats: adminProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.event.findMany({
        where: between(
          event.startingDate,
          input.from.toISOString(),
          input.to.toISOString(),
        ),
        with: {
          ticketGroups: {
            where: ne(ticketGroup.status, 'BOOKED'),
            columns: {
              amountTickets: true,
            },
            with: {
              emittedTickets: {
                where: between(
                  emittedTicket.createdAt,
                  input.from.toISOString(),
                  input.to.toISOString(),
                ),
                columns: {
                  scanned: true,
                },
              },
              ticketTypePerGroups: {
                with: {
                  ticketType: true,
                },
              },
            },
          },
        },
      });

      const stats = data.map((e) => {
        const { totalRaised, totalSold } = e.ticketGroups
          .flatMap((ticketGroup) => ticketGroup.ticketTypePerGroups)
          .reduce(
            (acc, ttpg) => {
              const price = ttpg.ticketType?.price ?? 0;
              const amount = ttpg.amount ?? 0;

              acc.totalRaised += amount * price;
              acc.totalSold += amount;

              return acc;
            },
            { totalRaised: 0, totalSold: 0 },
          );
        const allEt = e.ticketGroups.flatMap((tg) =>
          tg.emittedTickets.map((et) => et.scanned),
        );
        const attendance = allEt.filter((et) => et).length;

        const amountEt = e.ticketGroups.reduce((acc, tg) => {
          acc += tg.emittedTickets.length;
          return acc;
        }, 0);

        return {
          id: e.id,
          name: e.name,
          attendance,
          totalRaised,
          totalSold,
          totalEmitted: amountEt,
        };
      });

      return stats;
    }),
  getLocationsStats: adminProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.location.findMany({
        columns: {
          id: true,
          name: true,
        },
        with: {
          events: {
            with: {
              ticketGroups: {
                where: ne(ticketGroup.status, 'BOOKED'),
                columns: {
                  amountTickets: true,
                },
                with: {
                  emittedTickets: {
                    where: between(
                      emittedTicket.createdAt,
                      input.from.toISOString(),
                      input.to.toISOString(),
                    ),
                    columns: {
                      scanned: true,
                    },
                  },
                  ticketTypePerGroups: {
                    with: {
                      ticketType: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const stats = data.map((l) => {
        const { totalRaised, totalSold } = l.events
          .flatMap((e) => e.ticketGroups)
          .flatMap((ticketGroup) => ticketGroup.ticketTypePerGroups)
          .reduce(
            (acc, ttpg) => {
              const price = ttpg.ticketType?.price ?? 0;
              const amount = ttpg.amount ?? 0;

              acc.totalRaised += amount * price;
              acc.totalSold += amount;

              return acc;
            },
            { totalRaised: 0, totalSold: 0 },
          );
        const allEt = l.events
          .flatMap((e) => e.ticketGroups)
          .flatMap((tg) => tg.emittedTickets.map((et) => et.scanned));
        const attendance = allEt.filter((et) => et).length;

        const amountEt = l.events
          .flatMap((e) => e.ticketGroups)
          .reduce((acc, tg) => {
            acc += tg.emittedTickets.length;
            return acc;
          }, 0);

        return {
          id: l.id,
          name: l.name,
          attendance,
          totalRaised,
          totalSold,
          totalEmitted: amountEt,
        };
      });

      return stats;
    }),
  getEventHourlyAttendance: adminProcedure
    .input(
      z.object({
        eventId: z.string(),
        from: z.date(),
        to: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.event.findFirst({
        where: (event, { eq }) => eq(event.id, input.eventId),
        with: {
          ticketGroups: {
            where: ne(ticketGroup.status, 'BOOKED'),
            with: {
              emittedTickets: {
                where: and(
                  between(
                    emittedTicket.createdAt,
                    input.from.toISOString(),
                    input.to.toISOString(),
                  ),
                  eq(emittedTicket.scanned, true),
                ),
                columns: {
                  scannedAt: true,
                },
              },
            },
          },
        },
      });

      if (!data) {
        return {
          chartData: [],
          eventStart: null,
          eventEnd: null,
        };
      }

      const eventStart = parseISO(data.startingDate);
      const eventEnd = parseISO(data.endingDate);

      const scannedTickets = data.ticketGroups.flatMap((tg) =>
        tg.emittedTickets.filter((et) => et.scannedAt),
      );

      const startHour = getHours(eventStart);
      const endHour = getHours(eventEnd);

      // Diferentes dias
      const eventSpansMultipleDays = !isSameDay(eventStart, eventEnd);

      const hoursToShow: number[] = [];

      if (!eventSpansMultipleDays) {
        for (let hour = startHour; hour <= endHour; hour++) {
          hoursToShow.push(hour);
        }
      } else {
        for (let hour = 0; hour < 24; hour++) {
          hoursToShow.push(hour);
        }
      }

      const hourlyData: Record<number, number> = {};

      hoursToShow.forEach((hour) => {
        hourlyData[hour] = 0;
      });

      // Cantidad de tickets por hora
      scannedTickets.forEach((ticket) => {
        if (ticket.scannedAt) {
          const scanDate = parseISO(ticket.scannedAt);
          const hour = getHours(scanDate);
          if (hourlyData.hasOwnProperty(hour)) {
            hourlyData[hour]++;
          }
        }
      });

      const chartData = Object.entries(hourlyData).map(([hour, count]) => ({
        hour: format(new Date(0, 0, 0, parseInt(hour)), 'HH:mm'),
        attendance: count,
      }));

      return {
        chartData,
        eventStart: eventStart.toISOString(),
        eventEnd: eventEnd.toISOString(),
      };
    }),
});
