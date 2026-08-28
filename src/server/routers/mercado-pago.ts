import { and, eq } from 'drizzle-orm';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import z from 'zod';

import { eventXorganizer, ticketGroup } from '@/drizzle/schema';
import { hasMercadoPagoCredentials } from '@/server/services/mercadoPagoCredentials';
import { calculateTotalPrice } from '@/server/services/ticketGroup';
import { adminProcedure, publicProcedure, router } from '@/server/trpc';

export const createPreferenceSchema = z.object({
  ticketGroupId: z.string(),
});

export const mercadoPagoRouter = router({
  hasCredentials: adminProcedure.query(({ ctx }) => {
    return hasMercadoPagoCredentials(
      ctx.instance.mercadoPagoAccessToken,
      ctx.instance.mercadoPagoRefreshToken,
    );
  }),
  createPreference: publicProcedure
    .input(createPreferenceSchema)
    .query(async ({ ctx, input }) => {
      // validar el ticketgroupId
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input.ticketGroupId),
        columns: {
          id: true,
          invitedById: true,
        },
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

      if (!ctx.instance.mercadoPagoAccessToken) {
        throw new Error('Mercado Pago no está configurado');
      }

      const mercadoPago = new MercadoPagoConfig({
        accessToken: ctx.instance.mercadoPagoAccessToken,
      });

      // Get discount percentage from organizer if exists
      let discountPercentage: number | null = null;
      if (group.invitedById) {
        const eventOrganizer = await ctx.db.query.eventXorganizer.findFirst({
          where: and(
            eq(eventXorganizer.eventId, group.event.id),
            eq(eventXorganizer.organizerId, group.invitedById),
          ),
          columns: {
            discountPercentage: true,
          },
        });

        if (eventOrganizer?.discountPercentage) {
          discountPercentage = eventOrganizer.discountPercentage;
        }
      }

      // calcular el precio total
      const totalPrice = await calculateTotalPrice(ctx.db, {
        ticketGroupId: input.ticketGroupId,
        discountPercentage,
      });

      // Actualizar el totalAmount del ticketGroup
      await ctx.db
        .update(ticketGroup)
        .set({
          totalAmount: totalPrice.toFixed(2),
        })
        .where(eq(ticketGroup.id, input.ticketGroupId));

      const preference = await new Preference(mercadoPago).create({
        body: {
          items: [
            {
              id: group.id,
              title: group.event.name,
              description: group.event.description,
              quantity: 1,
              unit_price: totalPrice,
            },
          ],
          external_reference: group.id,
          auto_return: 'approved',
          back_urls: {
            success: `${ctx.instance.publicUrl}/tickets/${group.id}`,
            pending: `${ctx.instance.publicUrl}/tickets/${group.id}`,
            failure: `${ctx.instance.publicUrl}/tickets/error`,
          },
          metadata: {
            ticket_group_id: group.id,
            instance_url: ctx.instance.publicUrl,
          },
        },
      });
      return preference.init_point!;
    }),
});
