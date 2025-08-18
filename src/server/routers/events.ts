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
import { generateSlug } from '@/server/utils/utils';
import { eq, like } from 'drizzle-orm';
import z from 'zod';

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

            const ticketTypesCreated = await tx
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

            const ticketTypesUpdated = await Promise.all(
              ticketTypes.map(async (type) => {
                // (ticketType == table)
                const [updated] = await tx
                  .update(ticketType)
                  .set({
                    ...type,
                    maxSellDate: type.maxSellDate?.toISOString(),
                    scanLimit: type.scanLimit?.toISOString(),
                  })
                  .where(eq(ticketType.id, type.id))
                  .returning();

                return updated;
              }),
            );

            return { eventUpdated, ticketTypesUpdated };
          } catch (error) {
            tx.rollback();
            throw error;
          }
        },
      );

      return { eventUpdated, ticketTypesUpdated };
    }),
});
