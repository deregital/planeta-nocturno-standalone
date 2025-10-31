import z from 'zod';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { and, eq } from 'drizzle-orm';

import { publicProcedure, router } from '@/server/trpc';
import { eventXorganizer, ticketGroup } from '@/drizzle/schema';
import { calculateTotalPrice } from '@/server/services/ticketGroup';

export const createPreferenceSchema = z.object({
  ticketGroupId: z.string(),
});

export const mercadoPago = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? '',
});

export const mercadoPagoRouter = router({
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
      const totalPrice = await calculateTotalPrice({
        ticketGroupId: input.ticketGroupId,
        discountPercentage,
      });

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
            success: `${process.env.INSTANCE_WEB_URL}/tickets/${group.id}`,
            pending: `${process.env.INSTANCE_WEB_URL}/tickets/error`,
            failure: `${process.env.INSTANCE_WEB_URL}/tickets/error`,
          },
        },
      });
      return preference.init_point!;
    }),
});
