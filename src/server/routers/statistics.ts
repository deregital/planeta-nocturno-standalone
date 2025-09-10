import { and, between, ne } from 'drizzle-orm';
import z from 'zod';

import { emittedTicket, ticketGroup } from '@/drizzle/schema';
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

      // Asistencia por genero
      const genderCounts: Record<string, number> = {};
      for (const ticket of allTickets) {
        if (!ticket.scanned) continue;
        const gender = ticket.gender;
        if (!genderCounts[gender]) {
          genderCounts[gender] = 0;
        }
        genderCounts[gender]++;
      }

      console.log(genderCounts);
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
});
