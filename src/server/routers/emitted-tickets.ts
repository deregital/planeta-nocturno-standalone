import { emittedTicket } from '@/drizzle/schema';
import { protectedProcedure, publicProcedure, router } from '@/server/trpc';
import { createManyTicketSchema } from '../schemas/emitted-tickets';
import { z } from 'zod';
import { decryptString } from '../utils/utils';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export const emittedTicketsRouter = router({
  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const values = input.map((ticket) => ({
        ...ticket,
        birthDate: ticket.birthDate.toISOString(),
      }));
      const res = await ctx.db.insert(emittedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),

  scan: protectedProcedure
    .input(
      z.object({
        barcode: z.string(),
        eventId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let decryptedTicketId: string;
      try {
        decryptedTicketId = decryptString(input.barcode);
      } catch {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cadena inválida',
        });
      }

      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: and(
          eq(emittedTicket.id, decryptedTicketId),
          eq(emittedTicket.eventId, input.eventId),
        ),
        with: {
          ticketType: true,
          ticketGroup: {
            with: {
              event: true,
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }
      let extraInfo: string = '';

      if (ticket.scanned) {
        return {
          success: false,
          ticket,
          text: 'Ticket ya escaneado',
          extraInfo: `${
            ticket.scannedAt
              ? `A las ${formatInTimeZone(
                  new Date(ticket.scannedAt),
                  'America/Argentina/Buenos_Aires',
                  'HH:mm',
                )}`
              : ''
          }`,
        };
      }

      await ctx.db
        .update(emittedTicket)
        .set({
          scanned: true,
          scannedAt: new Date().toISOString(),
          scannedByUserId: ctx.session.user.id,
        })
        .where(eq(emittedTicket.id, decryptedTicketId));

      if (
        ticket.ticketType.scanLimit &&
        new Date(ticket.ticketType.scanLimit) < new Date()
      ) {
        extraInfo = `Ticket expirado, límite de horario era ${format(
          new Date(ticket.ticketType.scanLimit),
          'dd/MM/yyyy HH:mm',
        )}`;
      }

      return {
        success: true,
        ticket,
        text: `Escaneado con éxito: ${ticket.fullName}`,
        extraInfo,
      };
    }),

  getByEventId: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tickets = await ctx.db.query.emittedTicket.findMany({
        where: eq(emittedTicket.eventId, input.eventId),
      });

      return tickets;
    }),
});
