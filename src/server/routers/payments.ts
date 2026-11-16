import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import { ticketGroup } from '@/drizzle/schema';
import {
  getPaymentMethodStates,
  listActivePaymentProviders,
  listPaymentOptionsForGroup,
  type ProviderMethod,
  setPaymentMethodEnabled,
  setPaymentMethodOrder,
  startPayment,
} from '@/server/payments/methods';
import { PAYMENT_PROVIDERS } from '@/server/payments/registry';
import { assertTicketGroupEventNotBlocked } from '@/server/services/eventBlock';
import {
  anyPermissionProcedure,
  permissionProcedure,
  publicProcedure,
  router,
} from '@/server/trpc';

const methodSchema = z.custom<ProviderMethod>(
  (value) => PAYMENT_PROVIDERS.some((provider) => provider.method === value),
  'Medio de pago desconocido',
);

export const paymentsRouter = router({
  /** Los medios que ve el comprador en el checkout, en orden. */
  checkoutOptions: publicProcedure.query(async ({ ctx }) => {
    const providers = await listActivePaymentProviders(ctx);
    return providers.map((provider) => ({
      method: provider.method,
      label: provider.label,
      description: provider.buyerDescription,
    }));
  }),
  /**
   * Inicia (o vuelve a iniciar) el pago de una compra ya completada que
   * sigue reservada: reintentar Mercado Pago o pasar a otro medio.
   */
  start: publicProcedure
    .input(z.object({ ticketGroupId: z.uuid(), method: methodSchema }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.db.query.ticketGroup.findFirst({
        where: eq(ticketGroup.id, input.ticketGroupId),
        columns: { status: true, createdAt: true },
        with: {
          ticketTypePerGroups: { columns: { amount: true }, limit: 1 },
          emittedTickets: { columns: { id: true }, limit: 1 },
        },
      });
      // Sin reserva vigente (venció, se pagó o todavía no se completaron los
      // datos) no se cobra.
      if (
        !group ||
        group.status !== 'BOOKED' ||
        group.ticketTypePerGroups.length === 0 ||
        group.emittedTickets.length === 0
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'La reserva ya no está activa',
        });
      }
      await assertTicketGroupEventNotBlocked(ctx.db, input.ticketGroupId);

      const options = await listPaymentOptionsForGroup(ctx, group.createdAt);
      if (!options.some((provider) => provider.method === input.method)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Ese medio de pago no está disponible para esta compra',
        });
      }
      const payment = await startPayment(
        ctx,
        input.ticketGroupId,
        input.method,
      );
      if (!payment) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No hay medios de pago disponibles',
        });
      }
      return payment;
    }),
  /** Los medios de pago con su estado, en el orden en que se ofrecen. */
  methods: permissionProcedure('payments:manage').query(async ({ ctx }) => {
    const states = await getPaymentMethodStates(ctx);
    return states.map((state) => ({
      method: state.provider.method,
      label: state.provider.label,
      confirmation: state.provider.confirmation,
      status: state.status,
    }));
  }),
  /** Si hay algún medio activo: sin uno no se pueden vender entradas pagas. */
  hasActiveMethod: anyPermissionProcedure([
    'payments:manage',
    'events:create',
    'events:update',
  ]).query(async ({ ctx }) => {
    const states = await getPaymentMethodStates(ctx);
    return states.some((state) => state.status === 'active');
  }),
  setEnabled: permissionProcedure('payments:manage')
    .input(z.object({ method: methodSchema, enabled: z.boolean() }))
    .mutation(({ ctx, input }) =>
      setPaymentMethodEnabled(ctx, input.method, input.enabled),
    ),
  setOrder: permissionProcedure('payments:manage')
    .input(z.object({ methods: z.array(methodSchema) }))
    .mutation(({ ctx, input }) => setPaymentMethodOrder(ctx, input.methods)),
});
