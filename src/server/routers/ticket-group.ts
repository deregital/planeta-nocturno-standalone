import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  ticketGroup,
  ticketTypePerGroup,
  ticketXorganizer,
} from '@/drizzle/schema';
import { invitedBySchema } from '@/server/schemas/emitted-tickets';
import { publicProcedure, router } from '@/server/trpc';
import { generatePdf } from '@/server/utils/ticket-template';

export const ticketGroupSchema = z.object({
  id: z.uuid(), // uuid generado por defaultRandom()
  status: z.enum(['BOOKED', 'FREE', 'PAID']), // asumido según tu enum
  amountTickets: z.number().int().min(0), // default 0 en DB
  eventId: z.uuid(), // FK
  createdAt: z.iso.datetime({ offset: true }), // timestamp con zona horaria en formato string
});

export const ticketGroupRouter = router({
  create: publicProcedure
    .input(
      z.object({
        eventId: ticketGroupSchema.shape.eventId,
        ticketsPerType: z
          .object({
            ticketTypeId: z.string(),
            amount: z.number().int().min(0),
          })
          .array(),
        invitedBy: invitedBySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ticketsPerType.every((ticket) => ticket.amount <= 0)) {
        throw new Error('No se han seleccionado tickets para comprar');
      }

      const result = await ctx.db.transaction(async (tx) => {
        // Si hay un invitedBy explícito, usarlo
        const invitedById = input.invitedBy ?? null;

        const ticketGroupData = {
          eventId: input.eventId,
          status: 'BOOKED' as const,
          amountTickets: input.ticketsPerType.reduce(
            (sum, ticket) => sum + ticket.amount,
            0,
          ),
          invitedById,
        };

        const result = await tx
          .insert(ticketGroup)
          .values(ticketGroupData)
          .returning();

        if (!result) {
          tx.rollback();
          throw new Error('No se pudo crear el grupo de tickets');
        }

        const ticketGroupId = result[0].id;

        // Insertar las relaciones con los tipos de tickets
        const ticketTypePerGroups = input.ticketsPerType
          .map((ticket) => ({
            ticketGroupId,
            ticketTypeId: ticket.ticketTypeId,
            amount: ticket.amount,
          }))
          .filter((ticketType) => ticketType.amount > 0);

        await tx.insert(ticketTypePerGroup).values(ticketTypePerGroups);

        return ticketGroupId;
      });

      if (!result) throw 'Error al crear ticketGroup';
      return result;
    }),
  getById: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: {
          id: true,
          status: true,
          amountTickets: true,
          eventId: true,
          createdAt: true,
          invitedById: true,
          isOrganizerGroup: true,
        },
        with: {
          user: {
            columns: {
              id: true,
              fullName: true,
              code: true,
            },
          },
          ticketTypePerGroups: {
            with: {
              ticketType: {
                columns: {
                  id: true,
                  name: true,
                  description: true,
                  price: true,
                  category: true,
                },
              },
            },
          },
          event: {
            columns: {
              id: true,
              name: true,
              description: true,
              startingDate: true,
              endingDate: true,
              coverImageUrl: true,
              inviteCondition: true,
              extraTicketData: true,
              emailNotification: true,
              serviceFee: true,
            },
            with: {
              location: {
                columns: {
                  id: true,
                  name: true,
                  address: true,
                },
              },
              eventCategory: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new Error('ticketGroup no encontrado');
      }

      return {
        ...group,
        invitedBy: group.user?.fullName ?? '-',
        organizerCode: group.user?.code ?? null,
        organizerId: group.invitedById ?? null,
      };
    }),
  getTicketTypePerGroupById: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.ticketTypePerGroup.findMany({
        where: eq(ticketTypePerGroup.ticketGroupId, input),
      });
      return groups;
    }),
  getTicketsByEvent: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.ticketGroup.findMany({
        where: eq(ticketGroup.eventId, input),
        columns: {
          id: true,
        },
        with: {
          ticketTypePerGroups: {
            columns: {
              amount: true,
            },
            with: {
              ticketType: {
                columns: {
                  id: true,
                  name: true,
                  description: true,
                  maxAvailable: true,
                  maxPerPurchase: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      return groups;
    }),
  findById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const group = await ctx.db.query.ticketGroup.findFirst({
      where: eq(ticketGroup.id, input),
    });

    if (!group) {
      throw new Error('ticketGroup no encontrado');
    }

    return group;
  }),
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['FREE', 'PAID']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(ticketGroup)
        .set({
          status: input.status,
        })
        .where(eq(ticketGroup.id, input.id))
        .returning();

      return result[0];
    }),
  updateInvitedBy: publicProcedure
    .input(z.object({ id: ticketGroupSchema.shape.id, invitedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db
        .update(ticketGroup)
        .set({ invitedById: input.invitedBy || null })
        .where(eq(ticketGroup.id, input.id))
        .returning();

      return group[0];
    }),
  updateTicketXOrganizerTicketGroupId: publicProcedure
    .input(
      z.object({
        code: z.string(),
        eventId: z.string().uuid(),
        ticketGroupId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(ticketXorganizer)
        .set({ ticketGroupId: input.ticketGroupId })
        .where(
          and(
            eq(ticketXorganizer.code, input.code.toUpperCase()),
            eq(ticketXorganizer.eventId, input.eventId),
          ),
        )
        .returning();

      return result[0];
    }),
  updateTicketXOrganizerTicketId: publicProcedure
    .input(
      z.object({
        ticketGroupId: z.string().uuid(),
        organizerId: z.string().uuid(),
        ticketId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(ticketXorganizer)
        .set({ ticketId: input.ticketId })
        .where(
          and(
            eq(ticketXorganizer.ticketGroupId, input.ticketGroupId),
            eq(ticketXorganizer.organizerId, input.organizerId),
          ),
        )
        .returning();

      return result[0];
    }),
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const result = await ctx.db
      .delete(ticketGroup)
      .where(eq(ticketGroup.id, input))
      .returning();

    if (result.length === 0) {
      throw new Error('Ticket group no encontrado');
    }

    return result[0];
  }),
  getTotalPriceById: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        with: {
          ticketTypePerGroups: {
            with: {
              ticketType: {
                columns: {
                  price: true,
                },
              },
            },
            columns: {
              amount: true,
            },
          },
        },
      });

      if (!group) {
        throw new Error('ticketGroup no encontrado');
      }

      const totalPrice = group.ticketTypePerGroups.reduce(
        (total, ticketType) => {
          return total + ticketType.amount * (ticketType.ticketType.price ?? 0);
        },
        0,
      );

      return totalPrice;
    }),
  generatePdfsByTicketGroupId: publicProcedure
    .input(ticketGroupSchema.shape.id)
    .query(async ({ ctx, input }) => {
      // Traerme todos los datos
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input),
        columns: {
          status: true,
          invitedById: true,
        },
        with: {
          user: {
            columns: {
              fullName: true,
            },
          },
          emittedTickets: {
            columns: {
              id: true,
              fullName: true,
              mail: true,
              dni: true,
              createdAt: true,
              slug: true,
            },
            with: {
              ticketType: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          ticketTypePerGroups: {
            columns: {
              amount: true,
            },
            with: {
              ticketType: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          event: {
            columns: {
              name: true,
              startingDate: true,
              ticketSlugVisibleInPdf: true,
            },
            with: {
              location: {
                columns: {
                  address: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'TicketGroup no encontrado',
        });
      }

      // Verificar que este paid/free
      if (group?.status === 'BOOKED') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'El ticketGroup no está concretado',
        });
      }

      // Generar los PDFs
      if (!group?.emittedTickets) {
        throw new Error('No hay tickets emitidos');
      }

      const pdfPromises = group.emittedTickets.map(async (ticket) => {
        const blob = await generatePdf({
          eventName: group.event.name,
          eventDate: group.event.startingDate,
          eventLocation: group.event.location.address,
          createdAt: ticket.createdAt,
          dni: ticket.dni,
          fullName: ticket.fullName,
          id: ticket.id,
          ticketType: ticket.ticketType.name,
          invitedBy: group.user?.fullName ?? '-',
          slug: ticket.slug,
          ticketSlugVisibleInPdf: group.event.ticketSlugVisibleInPdf,
        });
        return {
          ticket,
          pdf: {
            blob,
            base64: Buffer.from(await blob.arrayBuffer()).toString('base64'),
          },
        };
      });

      const pdfs = await Promise.all(pdfPromises);
      return pdfs;
    }),
});
