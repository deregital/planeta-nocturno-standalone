import type { Route } from 'next';

import { TRPCError } from '@trpc/server';
import { redirect } from 'next/navigation';

import { type TaloConnectResult } from '@/lib/payments/talo-paths';
import { logger } from '@/server/observability/logger';
import { requirePagePermission } from '@/server/rbac/guards';
import { trpc } from '@/server/trpc/server';

const settings = (result: TaloConnectResult) =>
  `/admin/settings?talo=${result}#medios-de-pago` as Route;

/** Vuelta de Talo con el código: termina la conexión y vuelve a la tarjeta. */
export default async function TaloConnectPage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string | string[];
    referred_user_id?: string | string[];
  }>;
}) {
  await requirePagePermission('payments:manage');
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code : null;
  const referredUserId =
    typeof params.referred_user_id === 'string'
      ? params.referred_user_id
      : null;

  if (!code) redirect(settings('cancelado'));

  let result: TaloConnectResult = 'conectado';
  try {
    await trpc.payments.completeTaloConnect({ code, referredUserId });
  } catch (error) {
    result =
      error instanceof TRPCError && error.code === 'PRECONDITION_FAILED'
        ? 'vencido'
        : error instanceof TRPCError && error.code === 'BAD_REQUEST'
          ? 'rechazado'
          : 'error';
    if (result === 'error') {
      logger.error('Talo connect failed', { error });
    }
  }
  // Fuera del try: redirect() lanza.
  redirect(settings(result));
}
