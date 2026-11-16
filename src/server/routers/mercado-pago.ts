import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { user } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';
import { transferAliasSchema } from '@/server/schemas/payment-settings';
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
import {
  assertOtherActivePaymentMethod,
  getPaymentMethodStates,
  setPaymentMethodEnabled,
} from '@/server/payments/methods';
import {
  getTransferAlias,
  hasActivePaidEvents,
  setTransferAlias,
} from '@/server/services/paymentSettings';
import { createMercadoPagoPreference } from '@/server/payments/providers/mercado-pago';
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
    'payments:manage',
    'events:create',
    'events:update',
  ]).query(({ ctx }) => {
    return hasMercadoPagoCredentials(
      ctx.instance.mercadoPagoAccessToken,
      ctx.instance.mercadoPagoRefreshToken,
    );
  }),
  getTransferAlias: permissionProcedure('payments:manage').query(({ ctx }) =>
    getTransferAlias(ctx.db),
  ),
  updateTransferAlias: permissionProcedure('payments:manage')
    .input(z.object({ transferAlias: transferAliasSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (!input.transferAlias) {
        await assertOtherActivePaymentMethod(
          ctx,
          'TRANSFER',
          'Hay eventos activos con entradas pagas: el alias es obligatorio mientras no haya otro medio de pago activo',
        );
      }
      await setTransferAlias(ctx.db, input.transferAlias);
    }),
  unlinkRequirements: permissionProcedure('payments:unlink').query(
    async ({ ctx }) => {
      const states = await getPaymentMethodStates(ctx);
      const othersActive = states.some(
        (state) =>
          state.status === 'active' && state.provider.method !== 'MERCADO_PAGO',
      );
      return {
        transferAlias: await getTransferAlias(ctx.db),
        requiresTransferAlias:
          !othersActive && (await hasActivePaidEvents(ctx.db)),
      };
    },
  ),
  requestUnlink: permissionProcedure('payments:unlink')
    .input(
      z.object({ transferAlias: transferAliasSchema.optional() }).optional(),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !ctx.instance.mercadoPagoAccessToken ||
        !ctx.instance.mercadoPagoRefreshToken
      ) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Mercado Pago no está vinculado',
        });
      }

      if (input?.transferAlias) {
        // El alias que se carga al desvincular queda como medio activo.
        await setTransferAlias(ctx.db, input.transferAlias);
        await setPaymentMethodEnabled(ctx, 'TRANSFER', true);
      } else {
        await assertOtherActivePaymentMethod(
          ctx,
          'MERCADO_PAGO',
          'Hay eventos activos con entradas pagas: ingresá un alias para recibir transferencias antes de desvincular',
        );
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
          await getTransferAlias(ctx.db),
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
    }),
  confirmUnlink: permissionProcedure('payments:unlink')
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertOtherActivePaymentMethod(
        ctx,
        'MERCADO_PAGO',
        'Hay eventos activos con entradas pagas: configurá un alias para recibir transferencias antes de desvincular',
      );

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
          html: generateMercadoPagoUnlinkedEmail(
            ctx.instance,
            result.pending,
            await getTransferAlias(ctx.db),
          ),
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
    .query(({ ctx, input }) =>
      createMercadoPagoPreference(ctx, input.ticketGroupId),
    ),
});
