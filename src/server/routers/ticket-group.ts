import { ticketGroup, ticketTypePerGroup } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
import { generatePdf } from '@/utils/ticket-template';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ticketsPerType.every((ticket) => ticket.amount <= 0)) {
        throw new Error('No se han seleccionado tickets para comprar');
      }

      const result = await ctx.db.transaction(async (tx) => {
        const ticketGroupData = {
          eventId: input.eventId,
          status: 'BOOKED' as const,
          amountTickets: input.ticketsPerType.reduce(
            (sum, ticket) => sum + ticket.amount,
            0,
          ),
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
        with: {
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

      return group;
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
        },
        with: {
          emittedTickets: {
            columns: {
              id: true,
              fullName: true,
              mail: true,
              dni: true,
              createdAt: true,
            },
          },
          event: {
            columns: {
              name: true,
              startingDate: true,
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

      // Verificar que este paid/free
      if (group?.status === 'BOOKED') {
        throw new Error('El ticketGroup no está concretado (?');
      }

      // Generar los PDFs
      if (!group?.emittedTickets) {
        throw new Error('QUE');
      }

      const pdfPromises = group.emittedTickets.map(async (ticket) => {
        return {
          ticket,
          pdf: await generatePdf({
            eventName: group.event.name,
            eventDate: group.event.startingDate,
            eventLocation: group.event.location.address,
            createdAt: ticket.createdAt,
            dni: ticket.dni,
            fullName: ticket.fullName,
            id: ticket.id,
          }),
        };
      });

      const pdfs = await Promise.all(pdfPromises);
      return pdfs;
    }),
});
