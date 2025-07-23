import { ticketGroup } from '@/drizzle/schema';
import { publicProcedure, router } from '@/server/trpc';
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
      ticketGroupSchema.pick({
        amountTickets: true,
        eventId: true,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(ticketGroup)
        .values({ ...input, status: 'BOOKED' })
        .returning();

      if (!result) throw 'Error al crear ticketGroup';
      return result[0];
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
  getPdf: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    // const { data, error } = await ctx.fetch.GET(
    //   '/ticket/get-pdfs-by-ticket-group/{ticketGroupId}',
    //   {
    //     params: { path: { ticketGroupId: input } },
    //   },
    // );
    // if (error) {
    //   throw handleError(error);
    // }
    return {
      pdfs: [
        {
          ticketId: 'string',
          pdfBase64: 'string',
        },
      ],
    };
  }),
  // update: publicProcedure
  //   .input(updateTicketGroupSchema.merge(z.object({ id: z.string() })))
  //   .mutation(async ({ ctx, input }) => {
  //     const { data, error } = await ctx.fetch.PATCH(
  //       '/ticket-group/update/{id}',
  //       {
  //         params: {
  //           path: {
  //             id: input.id,
  //           },
  //         },
  //         body: {
  //           ...input,
  //         },
  //       },
  //     );
  //     if (error) {
  //       throw handleError(error);
  //     }
  //     return data;
  //   }),

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
});
