import { TRPCError } from '@trpc/server';
import { differenceInYears, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import {
  emittedTicket,
  event,
  location,
  ticketGroup,
  ticketType as ticketTypeTable,
} from '@/drizzle/schema';
import {
  createManyTicketSchema,
  createTicketSchema,
  emittedTicketSchema,
} from '@/server/schemas/emitted-tickets';
import { sendMail } from '@/server/services/mail';
import {
  adminProcedure,
  publicProcedure,
  router,
  ticketingProcedure,
} from '@/server/trpc';
import { generatePdf } from '@/server/utils/ticket-template';
import {
  decryptString,
  generateSlug,
  getBuyersCodeByDni,
} from '@/server/utils/utils';

export const emittedTicketsRouter = router({
  create: ticketingProcedure
    .input(createTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const ticketCreated = await ctx.db.transaction(async (tx) => {
        try {
          const ticketType = await tx.query.ticketType.findFirst({
            where: eq(ticketTypeTable.id, input.ticketTypeId),
          });

          const [ticketGroupCreated] = await tx
            .insert(ticketGroup)
            .values({
              eventId: input.eventId,
              status:
                ticketType?.category === 'FREE'
                  ? 'FREE'
                  : input.paidOnLocation
                    ? 'PAID'
                    : 'BOOKED',
              amountTickets: 1,
              invitedById: input.invitedBy,
            })
            .returning();

          const lastEmitted = await tx.query.emittedTicket.findFirst({
            where: eq(emittedTicket.ticketGroupId, ticketGroupCreated.id),
            orderBy: desc(emittedTicket.createdAt),
            with: {
              ticketType: {
                columns: {
                  name: true,
                },
              },
            },
          });

          let slug = '';
          if (lastEmitted && lastEmitted.slug) {
            const parts = lastEmitted.slug.split('-');
            const count = parseInt(parts[parts.length - 1], 10);
            slug = generateSlug(`${lastEmitted.ticketType.name} ${count}`);
          } else {
            slug = generateSlug(`${ticketType?.name} 0`);
          }

          const [ticketCreated] = await tx
            .insert(emittedTicket)
            .values({
              ...input,
              birthDate: input.birthDate.toISOString(),
              ticketGroupId: ticketGroupCreated.id,
              scanned: true,
              scannedAt: new Date().toISOString(),
              scannedByUserId: ctx.session.user.id,
              slug,
            })
            .returning();

          return ticketCreated;
        } catch (error) {
          tx.rollback();
          throw error;
        }
      });
      return ticketCreated;
    }),

  createMany: publicProcedure
    .input(createManyTicketSchema)
    .mutation(async ({ ctx, input }) => {
      const uniqueTicketTypeIds = input.map((ticket) => ticket.ticketTypeId);

      // Fetch ticket type names and count existing tickets for each type in a single query
      const ticketTypeData = await ctx.db
        .select({
          ticketTypeId: ticketTypeTable.id,
          name: ticketTypeTable.name,
          existingCount: count(emittedTicket.id),
        })
        .from(ticketTypeTable)
        .leftJoin(
          emittedTicket,
          eq(ticketTypeTable.id, emittedTicket.ticketTypeId),
        )
        .where(inArray(ticketTypeTable.id, uniqueTicketTypeIds))
        .groupBy(ticketTypeTable.id, ticketTypeTable.name);

      const ticketTypes = new Map(
        ticketTypeData.map((data) => [data.ticketTypeId, data]),
      );

      // <TicketTypeId, Count>
      const newTicketCounts = new Map<string, number>();

      const values = input.map((ticket) => {
        const ticketTypeData = ticketTypes.get(ticket.ticketTypeId);
        if (!ticketTypeData) {
          throw new Error(
            `TicketType con ID: ${ticket.ticketTypeId} no encontrado`,
          );
        }

        const currentNewCount = newTicketCounts.get(ticket.ticketTypeId) || 0;
        const nextNewCount = currentNewCount + 1;
        newTicketCounts.set(ticket.ticketTypeId, nextNewCount);

        const totalCount = ticketTypeData.existingCount + nextNewCount;
        const slug = generateSlug(`${ticketTypeData.name} ${totalCount}`);

        return {
          ...ticket,
          birthDate: ticket.birthDate.toISOString(),
          slug,
          eventId: ticket.eventId ?? '',
        };
      });

      const res = await ctx.db.insert(emittedTicket).values(values).returning();

      if (!res) throw 'Error al crear ticket/s';
      return res;
    }),
  getAllUniqueBuyer: adminProcedure.query(async ({ ctx }) => {
    const data = await ctx.db
      .selectDistinctOn([emittedTicket.dni], {
        dni: emittedTicket.dni,
        fullName: emittedTicket.fullName,
        mail: emittedTicket.mail,
        gender: emittedTicket.gender,
        instagram: emittedTicket.instagram,
        birthDate: emittedTicket.birthDate,
        phoneNumber: emittedTicket.phoneNumber,
      })
      .from(emittedTicket)
      .orderBy(emittedTicket.dni, desc(emittedTicket.createdAt));

    const dnis = data.map((item) => item.dni);
    const buyerCodes = await getBuyersCodeByDni(ctx.db, dnis);

    const dataWithAge = data.map((buyer) => ({
      ...buyer,
      age: differenceInYears(new Date(), buyer.birthDate).toString(),
      buyerCode:
        buyerCodes?.find((code) => code.dni === buyer.dni)?.id.toString() ||
        '---',
    }));

    return dataWithAge;
  }),
  getUniqueBuyer: adminProcedure
    .input(emittedTicketSchema.shape.dni)
    .query(async ({ input, ctx }) => {
      const buyer = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.dni, input),
        columns: {
          fullName: true,
          dni: true,
          birthDate: true,
          phoneNumber: true,
          instagram: true,
          gender: true,
          mail: true,
        },
      });

      const events = await ctx.db
        .selectDistinctOn([event.id], {
          // Event
          id: event.id,
          eventName: event.name,
          eventStartingDate: event.startingDate,

          // TicketGroup
          ticketGroupId: ticketGroup.id,

          // Location
          locationName: location.name,
        })
        .from(emittedTicket)
        .leftJoin(ticketGroup, eq(emittedTicket.ticketGroupId, ticketGroup.id))
        .leftJoin(event, eq(ticketGroup.eventId, event.id))
        .leftJoin(location, eq(event.locationId, location.id))
        .where(
          and(eq(emittedTicket.dni, input), eq(emittedTicket.scanned, true)),
        );

      if (!buyer) {
        return null;
      }

      const buyerCode = await getBuyersCodeByDni(ctx.db, [buyer.dni]);

      const buyerWithAge = {
        ...buyer,
        age: differenceInYears(
          new Date(),
          new Date(buyer.birthDate),
        ).toString(),
        buyerCode:
          buyerCode?.find((code) => code.dni === buyer.dni)?.id.toString() ||
          '---',
      };

      return { buyer: buyerWithAge, events };
    }),
  getPdf: ticketingProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
        with: {
          ticketGroup: {
            with: {
              user: {
                columns: {
                  fullName: true,
                },
              },
              event: {
                with: {
                  location: true,
                },
              },
            },
          },
          ticketType: true,
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      const pdf = await generatePdf({
        eventName: ticket.ticketGroup.event.name,
        eventDate: ticket.ticketGroup.event.startingDate,
        eventLocation: ticket.ticketGroup.event.location.address,
        ticketType: ticket.ticketType.name,
        createdAt: ticket.createdAt,
        dni: ticket.dni,
        fullName: ticket.fullName,
        id: ticket.id,
        invitedBy: ticket.ticketGroup.user?.fullName ?? '-',
        slug: ticket.slug,
      });

      return pdf;
    }),

  scan: ticketingProcedure
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
        return {
          success: false,
          ticket: null,
          text: 'Ticket no encontrado',
          extraInfo: '',
        };
      }

      const ticketReturned = await ctx.db.query.emittedTicket.findFirst({
        where: and(
          eq(emittedTicket.id, decryptedTicketId),
          eq(emittedTicket.eventId, input.eventId),
        ),
        with: {
          ticketType: true,
          ticketGroup: {
            with: {
              event: true,
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      if (!ticketReturned) {
        return {
          success: false,
          ticket: null,
          text: 'Ticket no encontrado',
          extraInfo: '',
        };
      }
      let extraInfo: string = '';
      const ticket = {
        ...ticketReturned,
        ticketGroup: {
          ...ticketReturned.ticketGroup,
          invitedBy: ticketReturned.ticketGroup.user?.fullName || '-',
        },
      };

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
                )} ${ticket.ticketGroup.user?.fullName ? `- Invitado por ${ticket.ticketGroup.user.fullName}` : ''}`
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
        extraInfo: `${extraInfo} ${ticket.ticketGroup.user?.fullName ? `- Invitado por ${ticket.ticketGroup.user.fullName}` : ''}`,
      };
    }),

  manualScan: ticketingProcedure
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
      });
      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      await ctx.db
        .update(emittedTicket)
        .set({
          scanned: true,
          scannedAt: new Date().toISOString(),
          scannedByUserId: ctx.session.user.id,
        })
        .where(eq(emittedTicket.id, input.ticketId));

      return { success: true, ticket };
    }),
  getByEventId: ticketingProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tickets = await ctx.db.query.emittedTicket.findMany({
        where: eq(emittedTicket.eventId, input.eventId),
        with: {
          ticketType: true,
          ticketGroup: {
            with: {
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
        },
      });

      const buyerCodes = await getBuyersCodeByDni(
        ctx.db,
        tickets.map((ticket) => ticket.dni),
      );

      return tickets.map((ticket) => ({
        ...ticket,
        buyerCode:
          buyerCodes?.find((code) => code.dni === ticket.dni)?.id.toString() ||
          '---',
        ticketGroup: {
          ...ticket.ticketGroup,
          invitedBy: ticket.ticketGroup.user?.fullName || '-',
        },
      }));
    }),

  send: ticketingProcedure
    .input(
      z.object({
        ticketId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.query.emittedTicket.findFirst({
        where: eq(emittedTicket.id, input.ticketId),
        with: {
          ticketGroup: {
            with: {
              event: {
                with: {
                  location: true,
                },
              },
              user: {
                columns: {
                  fullName: true,
                },
              },
            },
          },
          ticketType: true,
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket no encontrado',
        });
      }

      const pdf = await generatePdf({
        eventName: ticket.ticketGroup.event.name,
        eventDate: ticket.ticketGroup.event.startingDate,
        eventLocation: ticket.ticketGroup.event.location.address,
        ticketType: ticket.ticketType.name,
        createdAt: ticket.createdAt,
        dni: ticket.dni,
        fullName: ticket.fullName,
        id: ticket.id,
        invitedBy: ticket.ticketGroup.user?.fullName ?? '-',
        slug: ticket.slug,
      });

      const { data, error } = await sendMail({
        to: ticket.mail,
        subject: `Ticket de ${ticket.ticketGroup.event.name}`,
        body: `Hola ${ticket.fullName}, te enviamos tu ticket de ${ticket.ticketGroup.event.name}`,
        attachments: [Buffer.from(await pdf.arrayBuffer())],
        eventName: ticket.ticketGroup.event.name,
      });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al enviar el correo',
        });
      }

      return { success: true, data };
    }),

  delete: adminProcedure
    .input(z.object({ ticketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(emittedTicket)
        .where(eq(emittedTicket.id, input.ticketId));
    }),
});
