import { barcodes, text, line, table } from '@pdfme/schemas';
import { eq, inArray, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import z from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { generate } from '@pdfme/generator';
import { type Font } from '@pdfme/common';

import { event as eventSchema, ticketType } from '@/drizzle/schema';
import {
  createEventSchema,
  eventSchema as eventSchemaZod,
} from '@/server/schemas/event';
import {
  createTicketTypeSchema,
  ticketTypeSchema,
} from '@/server/schemas/ticket-type';
import { protectedProcedure, publicProcedure, router } from '@/server/trpc';
import { type TicketType } from '@/server/types';
import { generateSlug, getDMSansFonts } from '@/server/utils/utils';
import {
  type PDFDataGroupedTicketType,
  presentismoPDFSchema,
  type PDFDataOrderName,
  presentismoPDFSchemaGroupedTicketType,
} from '@/server/utils/presentismo-pdf';

export const eventsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.event.findMany({
      with: {
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
  }),
  getActive: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.event.findMany({
      where: eq(eventSchema.isActive, true),
      with: {
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
  }),
  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const data = await ctx.db.query.event.findFirst({
      where: eq(eventSchema.id, input),
      with: {
        ticketTypes: {
          columns: {
            id: true,
            description: true,
            maxPerPurchase: true,
            maxAvailable: true,
            name: true,
            price: true,
          },
        },
        location: {
          columns: {
            address: true,
          },
        },
      },
    });

    if (!data) throw 'Evento no encontrado'; // Otra forma manejar errores?

    return data;
  }),
  getBySlug: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const data = await ctx.db.query.event.findFirst({
      where: eq(eventSchema.slug, input),
      with: {
        ticketGroups: {
          with: {
            emittedTickets: {
              with: {
                ticketType: true,
              },
            },
          },
        },
        ticketTypes: true,
        location: {
          columns: {
            id: true,
            address: true,
            name: true,
          },
        },
        eventCategory: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!data) return null;

    return data;
  }),
  create: protectedProcedure
    .input(
      z.object({
        event: createEventSchema,
        ticketTypes: createTicketTypeSchema.array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { event, ticketTypes } = input;
      const slug = generateSlug(event.name);

      const existingEvent = await ctx.db.query.event.findMany({
        where: like(eventSchema.slug, `${slug}%`),
      });

      // same slug is slug or slug-1, slug-2, etc
      const sameSlugAmount = existingEvent.filter((event) =>
        event.slug.match(new RegExp(`^${slug}-(\\d+)$`)),
      ).length;
      const sameSlug =
        sameSlugAmount > 0 ? `${slug}-${sameSlugAmount + 1}` : slug;

      const eventData = {
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        startingDate: event.startingDate.toISOString(),
        endingDate: event.endingDate.toISOString(),
        minAge: event.minAge,
        isActive: event.isActive,
        slug: sameSlug,
        locationId: event.locationId,
        categoryId: event.categoryId,
      };

      const { eventCreated, ticketTypesCreated } = await ctx.db.transaction(
        async (tx) => {
          try {
            const [eventCreated] = await tx
              .insert(eventSchema)
              .values(eventData)
              .returning();

            if (!eventCreated) throw 'Error al crear evento';

            let ticketTypesCreated: TicketType[] = [];

            if (ticketTypes.length !== 0) {
              ticketTypesCreated = await tx
                .insert(ticketType)
                .values(
                  ticketTypes.map((ticketType) => ({
                    ...ticketType,
                    maxSellDate: ticketType.maxSellDate?.toISOString(),
                    scanLimit: ticketType.scanLimit?.toISOString(),
                    eventId: eventCreated.id,
                  })),
                )
                .returning();
            }

            return { eventCreated, ticketTypesCreated };
          } catch (error) {
            tx.rollback();
            throw error;
          }
        },
      );

      return { eventCreated, ticketTypesCreated };
    }),
  update: protectedProcedure
    .input(
      z.object({
        event: eventSchemaZod,
        ticketTypes: ticketTypeSchema.array(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { event, ticketTypes } = input;
      const slug = generateSlug(event.name);

      const existingEvent = await ctx.db.query.event.findMany({
        where: like(eventSchema.slug, `${slug}%`),
      });

      // same slug is slug or slug-1, slug-2, etc
      const sameSlugAmount = existingEvent.filter((event) =>
        event.slug.match(new RegExp(`^${slug}-(\\d+)$`)),
      ).length;
      const sameSlug =
        sameSlugAmount > 0 ? `${slug}-${sameSlugAmount + 1}` : slug;

      const eventData = {
        id: event.id,
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        startingDate: event.startingDate.toISOString(),
        endingDate: event.endingDate.toISOString(),
        minAge: event.minAge,
        isActive: event.isActive,
        slug: sameSlug,
        locationId: event.locationId,
        categoryId: event.categoryId,
      };

      const { eventUpdated, ticketTypesUpdated } = await ctx.db.transaction(
        async (tx) => {
          try {
            const [eventUpdated] = await tx
              .update(eventSchema)
              .set({
                ...eventData,
              })
              .where(eq(eventSchema.id, eventData.id))
              .returning();

            if (!eventUpdated) throw 'Error al actualizar evento';

            const ticketTypesDB = await tx.query.ticketType.findMany({
              where: eq(ticketType.eventId, eventUpdated.id),
            });
            const deletedTicketTypesIds = ticketTypesDB
              .filter((type) => !ticketTypes.some((t) => t.id === type.id))
              .map((type) => type.id);
            if (deletedTicketTypesIds.length > 0) {
              await tx
                .delete(ticketType)
                .where(inArray(ticketType.id, deletedTicketTypesIds));
            }

            const ticketTypesUpdated = await Promise.all(
              ticketTypes.map(async (type) => {
                // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
                const { id, ...rest } = type;
                if (ticketTypesDB.find((t) => t.id === type.id)) {
                  const [updated] = await tx
                    .update(ticketType)
                    .set({
                      ...rest,
                      maxSellDate: type.maxSellDate?.toISOString(),
                      scanLimit: type.scanLimit?.toISOString(),
                      eventId: eventUpdated.id,
                    })
                    .where(eq(ticketType.id, type.id))
                    .returning();

                  return updated;
                } else if (type.id) {
                  const [created] = await tx
                    .insert(ticketType)
                    .values({
                      ...rest,
                      maxSellDate: type.maxSellDate?.toISOString(),
                      scanLimit: type.scanLimit?.toISOString(),
                      eventId: eventUpdated.id,
                    })
                    .returning();

                  return created;
                }
              }),
            );

            return { eventUpdated, ticketTypesUpdated };
          } catch (error) {
            tx.rollback();
            throw error;
          }
        },
      );

      revalidatePath(`/admin/event/edit/${event.slug}`);

      return { eventUpdated, ticketTypesUpdated };
    }),
  generatePresentismoOrderNamePDF: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { eventId } = input;
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, eventId),
        with: {
          ticketTypes: true,
          location: {
            columns: {
              address: true,
            },
          },
          ticketGroups: {
            with: {
              emittedTickets: {
                with: {
                  ticketType: true,
                },
              },
            },
          },
        },
      });

      if (!event) throw 'Evento no encontrado';

      const tickets = event.ticketGroups
        .flatMap((group) => group.emittedTickets)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

      const pdfData: PDFDataOrderName = [
        {
          qr: `${process.env.PLANETA_NOCTURNO_URL}/admin/event/${event.slug}`,
          ubicacion: event.location.address,
          nombre: event.name,
          fecha: formatInTimeZone(
            event.startingDate,
            'America/Argentina/Buenos_Aires',
            'dd/MM/yyyy',
          ),
          datos: tickets.map((ticket) => [
            ticket.fullName,
            ticket.ticketType.name,
            ticket.phoneNumber,
            ticket.dni,
            ticket.scanned ? '☑' : '☐',
          ]),
        },
      ];

      const plugins = {
        qrcode: barcodes.qrcode,
        text,
        line,
        table,
      };

      const { fontBold, fontSemiBold, fontLight, fontSymbols } =
        await getDMSansFonts();

      const font: Font = {
        'DMSans-Bold': {
          data: fontBold, // Provide the buffer instead of a string path
        },
        'DMSans-SemiBold': {
          data: fontSemiBold, // Provide the buffer instead of a string path
          fallback: true,
        },
        'DMSans-Light': {
          data: fontLight, // Provide the buffer instead of a string path
        },
        Symbols: {
          data: fontSymbols, // Provide the buffer instead of a string path
        },
      };

      try {
        const pdf = await generate({
          template: presentismoPDFSchema,
          inputs: pdfData,
          plugins,
          options: {
            font,
          },
        });
        return pdf;
      } catch (error) {
        throw error;
      }
    }),

  generatePresentismoGroupedTicketTypePDF: protectedProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { eventId } = input;
      const event = await ctx.db.query.event.findFirst({
        where: eq(eventSchema.id, eventId),
        with: {
          ticketTypes: true,
          location: {
            columns: {
              address: true,
            },
          },
          ticketGroups: {
            with: {
              emittedTickets: {
                with: {
                  ticketType: true,
                },
              },
            },
          },
        },
      });

      if (!event) throw 'Evento no encontrado';

      const tickets = event.ticketTypes.map((ticketType) => {
        return {
          ticketType: ticketType.name,
          tickets: event.ticketGroups
            .flatMap((group) => group.emittedTickets)
            .filter((ticket) => ticket.ticketType.id === ticketType.id)
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        };
      });

      const pdfData: PDFDataGroupedTicketType = [
        {
          qr: `${process.env.PLANETA_NOCTURNO_URL}/admin/event/${event.slug}`,
          ubicacion: event.location.address,
          nombre: event.name,
          fecha: formatInTimeZone(
            event.startingDate,
            'America/Argentina/Buenos_Aires',
            'dd/MM/yyyy',
          ),
          ...tickets.reduce(
            (acc, ticket) => {
              acc[`datos_${ticket.ticketType}`] = ticket.tickets.map(
                (ticket) => [
                  ticket.fullName,
                  ticket.ticketType.name,
                  ticket.phoneNumber,
                  ticket.dni,
                  ticket.scanned ? '☑' : '☐',
                ],
              );
              return acc;
            },
            {} as Record<
              `datos_${string}`,
              [string, string, string, string, string][]
            >,
          ),
          ...tickets.reduce(
            (acc, ticket) => {
              acc[`tipo_entrada_${ticket.ticketType}`] =
                `Tipo de entrada: ${ticket.ticketType}`;
              return acc;
            },
            {} as Record<`tipo_entrada_${string}`, string>,
          ),
        },
      ];

      const { fontBold, fontSemiBold, fontLight, fontSymbols } =
        await getDMSansFonts();

      const font: Font = {
        'DMSans-Bold': {
          data: fontBold, // Provide the buffer instead of a string path
        },
        'DMSans-SemiBold': {
          data: fontSemiBold, // Provide the buffer instead of a string path
          fallback: true,
        },
        'DMSans-Light': {
          data: fontLight, // Provide the buffer instead of a string path
        },
        Symbols: {
          data: fontSymbols, // Provide the buffer instead of a string path
        },
      };

      const plugins = {
        qrcode: barcodes.qrcode,
        text,
        line,
        table,
      };

      try {
        const pdf = await generate({
          template: presentismoPDFSchemaGroupedTicketType(tickets),
          inputs: pdfData,
          plugins,
          options: {
            font,
          },
        });

        return pdf;
      } catch (error) {
        throw error;
      }
    }),
});
