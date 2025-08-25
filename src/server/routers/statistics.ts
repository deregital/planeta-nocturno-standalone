import { and, between, ne } from 'drizzle-orm';
import z from 'zod';

import { ticketGroup } from '@/drizzle/schema';
import { protectedProcedure, router } from '@/server/trpc';

export const statisticsRouter = router({
  getStatistics: protectedProcedure
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

      return {
        totalRaised,
        totalSold,
        totalTickets,
        totalScanned,
        scannedPercentage,
        // data,
      };
    }),
});
