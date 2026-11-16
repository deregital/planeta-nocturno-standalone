import type { PaymentProvider } from '@/server/payments/types';

import { getTransferAlias } from '@/server/services/paymentSettings';
import { startTransferPayment } from '@/server/services/transferPayment';

/** Transferencia al alias de la plataforma. Cada pago lo confirma el staff. */
export const transferProvider: PaymentProvider = {
  method: 'TRANSFER',
  label: 'Transferencia',
  analyticsName: 'transfer',
  confirmation: 'manual',
  // La reserva queda hasta que el staff la libere o la cancele.
  hold: null,
  isConfigured: async ({ db }) => Boolean(await getTransferAlias(db)),
  start: async (ctx, ticketGroupId) => {
    const transferAlias = await getTransferAlias(ctx.db);
    if (!transferAlias) {
      throw new Error('La transferencia no está configurada');
    }
    const amount = await startTransferPayment(ctx.db, ctx.instance, {
      ticketGroupId,
      transferAlias,
    });
    return { type: 'instructions', alias: transferAlias, amount };
  },
};
