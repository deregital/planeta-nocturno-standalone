import { event as eventSchema, ticketType } from '@/drizzle/schema';
import { protectedProcedure, publicProcedure, router } from '@/server/trpc';
import { eq, like } from 'drizzle-orm';
import z from 'zod';
import { createEventSchema } from '@/server/schemas/event';
import { generateSlug } from '@/server/utils/utils';

export const eventsRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.event.findMany();
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
  create: protectedProcedure
    .input(createEventSchema)
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      const existingEvent = await ctx.db.query.event.findMany({
        where: like(eventSchema.slug, `${slug}%`),
      });

      // same slug is slug or slug-1, slug-2, etc
      const sameSlugAmount = existingEvent.filter((event) => event.slug.match(new RegExp(`^${slug}-(\\d+)$`))).length;
      const sameSlug = sameSlugAmount > 0 ? `${slug}-${sameSlugAmount + 1}` : slug;

      if (existingEvent) throw 'Evento con el mismo nombre ya existe';

      const eventData = {
        name: input.name,
        description: input.description,
        coverImageUrl: input.coverImageUrl,
        startingDate: input.startingDate.toISOString(),
        endingDate: input.endingDate.toISOString(),
        minAge: input.minAge,
        isActive: input.isActive,
        slug: sameSlug,
        locationId: input.locationId,
        categoryId: input.categoryId,
      };

      const { event, ticketTypesCreated } = await ctx.db.transaction(async (tx) => {
        try {
          const [event] = await tx
            .insert(eventSchema)
            .values(eventData)
            .returning();

          if (!event) throw 'Error al crear evento';

          const ticketTypesCreated = await tx
            .insert(ticketType)
            .values(
              input.ticketTypes.map((ticketType) => ({
                ...ticketType,
                maxSellDate: ticketType.maxSellDate?.toISOString(),
                scanLimit: ticketType.scanLimit?.toISOString(),
                eventId: event.id,
              })),
            )
            .returning();

          return { event, ticketTypesCreated };
        } catch (error) {
          tx.rollback();
          throw error;
        }
      });

      return { event, ticketTypesCreated };
    }),
});
