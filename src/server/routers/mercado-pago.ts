import { publicProcedure, router } from '@/server/trpc';
import z from 'zod';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { calculateTotalPrice } from '../services/ticketGroup';
import { eq } from 'drizzle-orm';
import { ticketGroup } from '@/drizzle/schema';

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

      // calcular el precio total
      const totalPrice = await calculateTotalPrice({
        ticketGroupId: input.ticketGroupId,
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
            success: `${process.env.PLANETA_NOCTURNO_URL}/payment/${group.id}`,
            pending: `${process.env.PLANETA_NOCTURNO_URL}/payment/error`,
            failure: `${process.env.PLANETA_NOCTURNO_URL}/payment/error`,
          },
        },
      });
      return preference.init_point!;
    }),
});
