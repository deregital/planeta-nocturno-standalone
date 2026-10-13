import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import z from 'zod';

import { eventXorganizer, ticketGroup, user } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';
import {
  generateMercadoPagoUnlinkedEmail,
  generateMercadoPagoUnlinkRequestEmail,
  sendMailWithoutAttachments,
} from '@/server/services/mail';
import { hasMercadoPagoCredentials } from '@/server/services/mercadoPagoCredentials';
import {
  confirmUnlink,
  createUnlinkToken,
  maskEmail,
  MERCADO_PAGO_UNLINK_PATH,
  releaseUnlinkRequest,
  reserveUnlinkRequest,
  UNLINK_REQUEST_TTL_MINUTES,
} from '@/server/services/mercadoPagoUnlink';
import { calculateTotalPrice } from '@/server/services/ticketGroup';
import {
  anyPermissionProcedure,
  permissionProcedure,
  publicProcedure,
  router,
} from '@/server/trpc';

export const createPreferenceSchema = z.object({
  ticketGroupId: z.string(),
});
export const mercadoPagoRouter = router({
  hasCredentials: anyPermissionProcedure([
    'mercadopago:link',
    'events:create',
    'events:update',
  ]).query(({ ctx }) => {
    return hasMercadoPagoCredentials(
      ctx.instance.mercadoPagoAccessToken,
      ctx.instance.mercadoPagoRefreshToken,
    );
  }),
  requestUnlink: permissionProcedure('mercadopago:unlink').mutation(
    async ({ ctx }) => {
      if (
        !ctx.instance.mercadoPagoAccessToken ||
        !ctx.instance.mercadoPagoRefreshToken
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Mercado Pago no está vinculado',
        });
      }

      const requester = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        columns: { email: true },
      });
      if (!requester) throw new TRPCError({ code: 'UNAUTHORIZED' });

      if (!reserveUnlinkRequest(ctx.session.user.id)) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Esperá un minuto antes de pedir otro mail',
        });
      }

      const link = new URL(MERCADO_PAGO_UNLINK_PATH, ctx.instance.publicUrl);
      link.searchParams.set(
        'token',
        createUnlinkToken(ctx.instance, ctx.session.user.id),
      );

      const mail = await sendMailWithoutAttachments(ctx.instance, {
        to: requester.email,
        subject: 'Confirmá la desvinculación de Mercado Pago',
        html: generateMercadoPagoUnlinkRequestEmail(
          ctx.instance,
          link.toString(),
          UNLINK_REQUEST_TTL_MINUTES,
        ),
      }).catch((error: unknown) => ({ error }));
      if (mail.error) {
        releaseUnlinkRequest(ctx.session.user.id);
        logger.error('Mercado Pago unlink email failed', { error: mail.error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo enviar el mail de confirmación',
        });
      }

      return {
        email: maskEmail(requester.email),
        expiresInMinutes: UNLINK_REQUEST_TTL_MINUTES,
      };
    },
  ),
  confirmUnlink: permissionProcedure('mercadopago:unlink')
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      let result: Awaited<ReturnType<typeof confirmUnlink>>;
      try {
        result = await confirmUnlink(
          ctx.instance,
          input.token,
          ctx.session.user.id,
        );
      } catch (error) {
        logger.error('Mercado Pago unlink failed', { error });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo desvincular Mercado Pago. Intentá nuevamente',
        });
      }

      if (!result) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El link no es válido o ya venció',
        });
      }

      const requester = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id),
        columns: { email: true },
      });
      if (requester) {
        const mail = await sendMailWithoutAttachments(ctx.instance, {
          to: requester.email,
          subject: 'Mercado Pago fue desvinculado',
          html: generateMercadoPagoUnlinkedEmail(ctx.instance, result.pending),
        }).catch((error: unknown) => ({ error }));
        if (mail.error) {
          logger.error('Mercado Pago unlinked email failed', {
            error: mail.error,
          });
        }
      }

      return result;
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
