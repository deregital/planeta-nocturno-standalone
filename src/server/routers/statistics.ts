import { format, getHours, parseISO } from 'date-fns';
import { and, between, eq, gte, lte, ne } from 'drizzle-orm';
import z from 'zod';

import { emittedTicket, event, ticketGroup } from '@/drizzle/schema';
import { adminProcedure, router } from '@/server/trpc';

export const statisticsRouter = router({
  getStatistics: adminProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
        eventId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const data = await ctx.db.query.ticketGroup.findMany({
        where: input.eventId
          ? and(
              ne(ticketGroup.status, 'BOOKED'),
              eq(ticketGroup.eventId, input.eventId),
            )
          : and(
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
  getEmittedTicketsPerHour: adminProcedure
    .input(
      z.object({
        from: z.date(),
        to: z.date(),
        eventId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.event.findMany({
        where: input.eventId
          ? eq(event.id, input.eventId)
          : and(
              gte(event.createdAt, input.from.toISOString()),
              lte(event.endingDate, input.to.toISOString()),
            ),
        columns: {
          id: true,
          name: true,
        },
        with: {
          ticketGroups: {
            where: ne(ticketGroup.status, 'BOOKED'),
            columns: {
              createdAt: true,
            },
            with: {
              emittedTickets: {
                columns: {
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!data || data.length === 0) {
        return {
          chartData: [],
          events: [],
        };
      }

      const eventsWithEmittedTickets = data.filter((event) => {
        const totalEmittedTickets = event.ticketGroups.reduce(
          (total, ticketGroup) => total + ticketGroup.emittedTickets.length,
          0,
        );
        return totalEmittedTickets > 0;
      });

      if (eventsWithEmittedTickets.length === 0) {
        return {
          chartData: [],
          events: [],
        };
      }

      const hoursWithSales = new Set<number>();
      eventsWithEmittedTickets.forEach((event) => {
        event.ticketGroups.forEach((ticketGroup) => {
          ticketGroup.emittedTickets.forEach((emittedTicket) => {
            const creationDate = parseISO(emittedTicket.createdAt);
            const hour = getHours(creationDate);
            hoursWithSales.add(hour);
          });
        });
      });

      if (hoursWithSales.size === 0) {
        return {
          chartData: [],
          events: [],
        };
      }

      const minHour = Math.min(...hoursWithSales);
      const maxHour = Math.max(...hoursWithSales);

      const hoursToShow: number[] = Array.from(
        { length: maxHour - minHour + 1 },
        (_, i) => minHour + i,
      );

      const chartData: Array<Record<string, string | number>> = hoursToShow.map(
        (hour) => {
          const hourData: Record<string, string | number> = {
            hour: format(new Date(0, 0, 0, hour), 'HH:mm'),
          };

          eventsWithEmittedTickets.forEach((event) => {
            hourData[event.name] = 0;
          });

          return hourData;
        },
      );

      eventsWithEmittedTickets.forEach((event) => {
        event.ticketGroups.forEach((ticketGroup) => {
          ticketGroup.emittedTickets.forEach((emittedTicket) => {
            const creationDate = parseISO(emittedTicket.createdAt);
            const hour = getHours(creationDate);
            const hourIndex = hoursToShow.indexOf(hour);

            if (hourIndex !== -1) {
              (chartData[hourIndex][event.name] as number)++;
            }
          });
        });
      });

      const events = eventsWithEmittedTickets.map((event) => ({
        id: event.id,
        name: event.name,
      }));

      return {
        chartData,
        events,
      };
    }),
});
