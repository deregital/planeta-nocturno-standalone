import type {
  PaymentContext,
  PaymentProvider,
  PaymentStart,
} from '@/server/payments/types';

import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';

import { paymentMethodSetting } from '@/drizzle/schema';
import { logger } from '@/server/observability/logger';
import { PAYMENT_PROVIDERS } from '@/server/payments/registry';
import { hasActivePaidEvents } from '@/server/services/paymentSettings';

export type ProviderMethod = PaymentProvider['method'];

/**
 * - `not_configured`: falta vincular la cuenta o cargar el alias.
 * - `active`: se ofrece a los compradores.
 * - `paused`: configurado pero no se ofrece. Los pagos en curso siguen.
 */
export type PaymentMethodStatus = 'not_configured' | 'active' | 'paused';

export type PaymentMethodState = {
  provider: PaymentProvider;
  enabled: boolean;
  configured: boolean;
  status: PaymentMethodStatus;
};

/** Todos los medios con su estado, en el orden en que se ofrecen. */
export async function getPaymentMethodStates(
  ctx: PaymentContext,
): Promise<PaymentMethodState[]> {
  const [rows, configured] = await Promise.all([
    ctx.db.select().from(paymentMethodSetting),
    Promise.all(PAYMENT_PROVIDERS.map((p) => p.isConfigured(ctx))),
  ]);
  const byMethod = new Map(rows.map((row) => [row.method, row]));

  return PAYMENT_PROVIDERS.map((provider, index) => {
    const row = byMethod.get(provider.method);
    // Un medio nuevo, sin fila todavía, queda activo y al final: se ofrece en
    // cuanto se configura.
    const enabled = row?.enabled ?? true;
    const isConfigured = configured[index];
    return {
      provider,
      enabled,
      configured: isConfigured,
      status: !isConfigured
        ? ('not_configured' as const)
        : enabled
          ? ('active' as const)
          : ('paused' as const),
      sortOrder: row?.sortOrder ?? PAYMENT_PROVIDERS.length + index,
      index,
    };
  })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.index - b.index)
    .map(({ provider, enabled, configured, status }) => ({
      provider,
      enabled,
      configured,
      status,
    }));
}

/** Los medios que se ofrecen a los compradores, en orden. */
export async function listActivePaymentProviders(ctx: PaymentContext) {
  const states = await getPaymentMethodStates(ctx);
  return states
    .filter((state) => state.status === 'active')
    .map((state) => state.provider);
}

/**
 * Inicia el pago con el primer medio activo. Si uno falla prueba el
 * siguiente; si fallan todos, propaga el error del último. Devuelve null si
 * no hay ningún medio activo.
 */
export async function startFirstActivePayment(
  ctx: PaymentContext,
  ticketGroupId: string,
): Promise<PaymentStart | null> {
  const providers = await listActivePaymentProviders(ctx);

  for (const [index, provider] of providers.entries()) {
    try {
      return await provider.start(ctx, ticketGroupId);
    } catch (error) {
      const next = providers[index + 1];
      if (!next) throw error;
      logger.warn('Payment start failed, trying next method', {
        ticketGroupId,
        method: provider.method,
        next: next.method,
        error,
      });
    }
  }
  return null;
}

/**
 * Frena un cambio que dejaría sin ningún medio activo a una plataforma con
 * eventos que venden entradas pagas. `without` es el medio que se pausa, se
 * desvincula o se queda sin configurar.
 */
export async function assertOtherActivePaymentMethod(
  ctx: PaymentContext,
  without: ProviderMethod,
  message = 'Hay eventos activos con entradas pagas: dejá activo otro medio de pago antes de hacer este cambio',
) {
  const states = await getPaymentMethodStates(ctx);
  const othersActive = states.some(
    (state) => state.status === 'active' && state.provider.method !== without,
  );
  if (othersActive) return;
  if (!(await hasActivePaidEvents(ctx.db))) return;
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message });
}

export async function setPaymentMethodEnabled(
  ctx: PaymentContext,
  method: ProviderMethod,
  enabled: boolean,
) {
  if (!enabled) {
    await assertOtherActivePaymentMethod(
      ctx,
      method,
      'Hay eventos activos con entradas pagas: no podés pausar el único medio de pago activo',
    );
  }
  const updatedAt = new Date().toISOString();
  await ctx.db
    .insert(paymentMethodSetting)
    .values({
      method,
      enabled,
      sortOrder: PAYMENT_PROVIDERS.findIndex((p) => p.method === method),
      updatedAt,
    })
    .onConflictDoUpdate({
      target: paymentMethodSetting.method,
      set: { enabled, updatedAt },
    });
}

/** Guarda el orden en que se ofrecen los medios. `methods` los trae a todos. */
export async function setPaymentMethodOrder(
  ctx: PaymentContext,
  methods: ProviderMethod[],
) {
  const known = PAYMENT_PROVIDERS.map((p) => p.method);
  if (
    methods.length !== known.length ||
    new Set(methods).size !== known.length ||
    methods.some((method) => !known.includes(method))
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El orden tiene que incluir cada medio de pago una vez',
    });
  }
  const updatedAt = new Date().toISOString();
  await ctx.db
    .insert(paymentMethodSetting)
    .values(
      methods.map((method, sortOrder) => ({ method, sortOrder, updatedAt })),
    )
    .onConflictDoUpdate({
      target: paymentMethodSetting.method,
      set: {
        sortOrder: sql`excluded."sortOrder"`,
        updatedAt: sql`excluded."updatedAt"`,
      },
    });
}
