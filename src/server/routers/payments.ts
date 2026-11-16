import z from 'zod';

import {
  getPaymentMethodStates,
  type ProviderMethod,
  setPaymentMethodEnabled,
  setPaymentMethodOrder,
} from '@/server/payments/methods';
import { PAYMENT_PROVIDERS } from '@/server/payments/registry';
import {
  anyPermissionProcedure,
  permissionProcedure,
  router,
} from '@/server/trpc';

const methodSchema = z.custom<ProviderMethod>(
  (value) => PAYMENT_PROVIDERS.some((provider) => provider.method === value),
  'Medio de pago desconocido',
);

export const paymentsRouter = router({
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
